/**
 * ============================================================
 * RADIO BINGO LIVE — GCU SOCKET.IO SERVER
 * Ultra-low latency, server-authoritative bingo backend.
 * Node.js + Express + Socket.io
 * ============================================================
 * SETUP:
 *   npm init -y
 *   npm install express socket.io cors
 *   node bingo-server.js
 * ============================================================
 */

'use strict';

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// I-initialize ang Firebase Admin para makapag-usap ang server sa Firestore at FCM
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    pingInterval: 10000,
    pingTimeout: 5000
});

app.use(cors());
app.use(express.json());

// ── CONFIG ─────────────────────────────────────────────────
const CFG = {
    LOBBY_DURATION_MS:    35000,  // 35 seconds lobby / mini-game phase
    TOP_SLOT_SPIN_MS:     6000,   // 6 seconds for slot spin animation
    TOP_SLOT_REVEAL_MS:   3000,   // 3 seconds to hold the reveal
    BALL_DRAW_INTERVAL_MS: 5500,  // 5.5 seconds between balls
    GAME_OVER_DURATION_MS: 18000, // 18 seconds game-over screen
    PORT:                 process.env.PORT || 3001
};

const MULTIPLIERS        = [2, 3, 5, 10, 20, 50, 100];
const WHEEL_SEGMENTS     = ['MISS','2x','MISS','3x','MISS','1.5x','MISS','5x','MISS','10x'];
const BINGO_RANGES       = { B:[1,15], I:[16,30], N:[31,45], G:[46,60], O:[61,75] };

// ── HELPERS ────────────────────────────────────────────────
function uid()   { return Math.random().toString(36).slice(2, 9).toUpperCase(); }
function rnd(a)  { return a[Math.floor(Math.random() * a.length)]; }

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function allBalls() {
    const balls = [];
    for (const [letter, [min, max]] of Object.entries(BINGO_RANGES)) {
        for (let n = min; n <= max; n++) {
            balls.push({ letter, number: n, display: `${letter}-${n}` });
        }
    }
    return balls;
}

function letterFor(n) {
    if (n <= 15) return 'B';
    if (n <= 30) return 'I';
    if (n <= 45) return 'N';
    if (n <= 60) return 'G';
    return 'O';
}

// Server-side bingo validation (12-way normal bingo)
function validateBingo(cardNumbers, drawnNumbers) {
    const drawn = new Set(drawnNumbers.map(String));
    const lines = [
        [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
        [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
        [0,6,12,18,24],[4,8,12,16,20]
    ];
    return lines.some(line =>
        line.every(i => cardNumbers[i] === 'FREE' || drawn.has(String(cardNumbers[i])))
    );
}

// ── GAME STATE ─────────────────────────────────────────────
let GS = {
    phase:          'lobby',   // 'lobby' | 'top_slot' | 'playing' | 'game_over'
    gameId:         uid(),
    topSlot:        null,      // { ball, number, letter, multiplier }
    drawnBalls:     [],        // array of ball objects
    remainingBalls: shuffle(allBalls()),
    winner:         null,      // { uid, name, photo, prize, multiplier, isSpecial }
    lobbyCountdown: CFG.LOBBY_DURATION_MS / 1000,
    phaseAt:        Date.now(),
    onlineCount:    0,
    winnerClaimed:  false
};

// ── TIMERS ─────────────────────────────────────────────────
let drawTimer       = null;
let lobbyTimer      = null;
let phaseTimer      = null;
let countdownTicker = null;

function clearAll() {
    [drawTimer, lobbyTimer, phaseTimer, countdownTicker].forEach(t => {
        if (t) clearInterval(t);
        if (t) clearTimeout(t);
    });
    drawTimer = lobbyTimer = phaseTimer = countdownTicker = null;
}

// ── BROADCAST ──────────────────────────────────────────────
function broadcastState(extra = {}) {
    io.emit('game_state', {
        phase:          GS.phase,
        gameId:         GS.gameId,
        topSlot:        GS.topSlot,
        drawnBalls:     GS.drawnBalls,
        winner:         GS.winner,
        lobbyCountdown: GS.lobbyCountdown,
        onlineCount:    GS.onlineCount,
        timestamp:      Date.now(),
        ...extra
    });
}

// ── PHASES ─────────────────────────────────────────────────

function startLobby() {
    clearAll();

    GS = {
        phase:          'lobby',
        gameId:         uid(),
        topSlot:        null,
        drawnBalls:     [],
        remainingBalls: shuffle(allBalls()),
        winner:         null,
        lobbyCountdown: CFG.LOBBY_DURATION_MS / 1000,
        phaseAt:        Date.now(),
        onlineCount:    GS.onlineCount,
        winnerClaimed:  false
    };

    io.emit('phase_change', { phase: 'lobby', gameId: GS.gameId });
    broadcastState();

    // Tick down the lobby countdown each second
    let cd = CFG.LOBBY_DURATION_MS / 1000;
    countdownTicker = setInterval(() => {
        cd--;
        GS.lobbyCountdown = cd;
        io.emit('lobby_tick', { remaining: cd });
        if (cd <= 0) {
            clearInterval(countdownTicker);
            countdownTicker = null;
            startTopSlot();
        }
    }, 1000);
}

function startTopSlot() {
    clearAll();
    GS.phase   = 'top_slot';
    GS.phaseAt = Date.now();

    // Pick special ball + multiplier via server RNG
    const pool    = allBalls();
    const special = rnd(pool);
    const mult    = rnd(MULTIPLIERS);

    GS.topSlot = {
        ball:       special.display,
        number:     special.number,
        letter:     special.letter,
        multiplier: mult
    };

    // Emit spin payload — result included so client can animate toward it
    io.emit('phase_change', { phase: 'top_slot' });
    io.emit('top_slot_spin', {
        spinDuration: CFG.TOP_SLOT_SPIN_MS,
        result:       GS.topSlot,
        timestamp:    Date.now()
    });

    broadcastState();

    // After spin + reveal hold → start game
    const total = CFG.TOP_SLOT_SPIN_MS + CFG.TOP_SLOT_REVEAL_MS;
    phaseTimer = setTimeout(startGame, total);
}

function startGame() {
    clearAll();
    GS.phase          = 'playing';
    GS.drawnBalls     = [];
    GS.winner         = null;
    GS.winnerClaimed  = false;
    GS.phaseAt        = Date.now();

    io.emit('phase_change', { phase: 'playing', topSlot: GS.topSlot, gameId: GS.gameId });
    broadcastState();

    // Ball draw engine
    drawTimer = setInterval(() => {
        if (GS.phase !== 'playing' || GS.winnerClaimed) {
            clearInterval(drawTimer);
            return;
        }
        if (GS.remainingBalls.length === 0) {
            clearInterval(drawTimer);
            endGame(null); // All balls drawn, no winner
            return;
        }

        const ball      = GS.remainingBalls.pop();
        const isSpecial = GS.topSlot && ball.number === GS.topSlot.number;
        GS.drawnBalls.push(ball);

        io.emit('ball_drawn', {
            ball,
            isSpecialBall:  isSpecial,
            multiplier:     isSpecial ? GS.topSlot.multiplier : 1,
            ballIndex:      GS.drawnBalls.length,
            totalDrawn:     GS.drawnBalls.length,
            timestamp:      Date.now()
        });

        broadcastState();
    }, CFG.BALL_DRAW_INTERVAL_MS);
}

function endGame(winner) {
    clearAll();
    GS.phase         = 'game_over';
    GS.winner        = winner;
    GS.winnerClaimed = true;
    GS.phaseAt       = Date.now();

    io.emit('phase_change', { phase: 'game_over', winner });
    broadcastState();

    // Back to lobby after cooldown
    phaseTimer = setTimeout(startLobby, CFG.GAME_OVER_DURATION_MS);
}

// ── SOCKET EVENTS ──────────────────────────────────────────
io.on('connection', (socket) => {
    GS.onlineCount++;
    io.emit('online_count', { count: GS.onlineCount });

    // Hydrate new client with full current state
    socket.emit('game_state', {
        phase:          GS.phase,
        gameId:         GS.gameId,
        topSlot:        GS.topSlot,
        drawnBalls:     GS.drawnBalls,
        winner:         GS.winner,
        lobbyCountdown: GS.lobbyCountdown,
        onlineCount:    GS.onlineCount,
        timestamp:      Date.now()
    });

    // If connecting mid-spin, re-send the spin event
    if (GS.phase === 'top_slot' && GS.topSlot) {
        const elapsed = Date.now() - GS.phaseAt;
        const remaining = Math.max(500, CFG.TOP_SLOT_SPIN_MS - elapsed);
        socket.emit('top_slot_spin', {
            spinDuration: remaining,
            result:       GS.topSlot,
            timestamp:    Date.now()
        });
    }

    // ── Bingo claim ──
    socket.on('claim_bingo', (data) => {
        if (GS.phase !== 'playing' || GS.winnerClaimed) {
            socket.emit('bingo_rejected', { reason: GS.winnerClaimed ? 'Already won' : 'Game not active' });
            return;
        }

        const { cardNumbers, uid: playerUid, name, photo } = data;
        if (!cardNumbers || !playerUid) return;

        const drawnNums = GS.drawnBalls.map(b => b.number);
        const valid     = validateBingo(cardNumbers, drawnNums);

        if (!valid) {
            socket.emit('bingo_rejected', { reason: 'Invalid card — keep trying!' });
            return;
        }

        GS.winnerClaimed = true;

        // Check if special ball was used in winning line
        const cardHasSpecial = GS.topSlot && cardNumbers.some(n => parseInt(n) === GS.topSlot.number);
        const specialDrawn   = GS.topSlot && drawnNums.includes(GS.topSlot.number);
        const isSpecial      = cardHasSpecial && specialDrawn;
        const multiplier     = isSpecial ? GS.topSlot.multiplier : 1;
        const prize          = 300 * multiplier;

        const winner = {
            uid:        playerUid,
            name,
            photo,
            prize,
            multiplier,
            isSpecial,
            gameId:     GS.gameId,
            timestamp:  Date.now()
        };

        io.emit('bingo_winner', winner);
        endGame(winner);
    });

    // ── Mini-game spin (server-side RNG) ──
    socket.on('mini_game_spin', (data) => {
        const { betAmount, uid: playerUid } = data || {};

        // Server picks the outcome and the target segment index
        const segIndex = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
        const result   = WHEEL_SEGMENTS[segIndex];

        let multiplier = 0;
        if (result !== 'MISS') {
            multiplier = parseFloat(result.replace('x', ''));
        }

        const winAmount = result !== 'MISS' ? Math.floor((betAmount || 10) * multiplier) : 0;

        socket.emit('mini_game_result', {
            segmentIndex: segIndex,
            result,
            multiplier,
            betAmount:    betAmount || 10,
            winAmount,
            isMiss:       result === 'MISS',
            timestamp:    Date.now()
        });
    });

    // ── Chat relay (broadcast to all) ──
    socket.on('chat_message', (msg) => {
        if (!msg || !msg.text || !msg.name) return;
        msg.text = msg.text.slice(0, 200); // Sanitize length
        io.emit('chat_message', { ...msg, timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
        GS.onlineCount = Math.max(0, GS.onlineCount - 1);
        io.emit('online_count', { count: GS.onlineCount });
    });
});

// ── REST: Admin endpoints ───────────────────────────────────
app.get('/state', (_, res) => res.json({
    phase:       GS.phase,
    gameId:      GS.gameId,
    drawn:       GS.drawnBalls.length,
    remaining:   GS.remainingBalls.length,
    topSlot:     GS.topSlot,
    online:      GS.onlineCount
}));

app.post('/admin/force-lobby', (_, res) => {
    startLobby();
    res.json({ ok: true, message: 'Forced to lobby phase.' });
});

app.post('/admin/force-start', (_, res) => {
    startTopSlot();
    res.json({ ok: true, message: 'Forced top slot + game start.' });
});

// ── BOOT ───────────────────────────────────────────────────
startLobby();

server.listen(CFG.PORT, () => {
    console.log(`\n🎱  Radio Bingo Live — GCU Server`);
    console.log(`    Listening on port ${CFG.PORT}`);
    console.log(`    State: http://localhost:${CFG.PORT}/state\n`);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
