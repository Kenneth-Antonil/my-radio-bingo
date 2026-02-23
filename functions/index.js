/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  RADIO BINGO — Firebase Cloud Functions                         ║
 * ║  Scheduled draws run SERVER-SIDE even when no one is online.    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * HOW TO DEPLOY:
 *   1. cd functions
 *   2. npm install
 *   3. firebase deploy --only functions
 *
 * REQUIRES: Firebase Blaze (pay-as-you-go) plan for scheduled functions.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onValueCreated } = require('firebase-functions/v2/database');
const admin     = require('firebase-admin');

admin.initializeApp();
const db = admin.database();

// ─────────────────────────────────────────────────────────────────────────────
// BINGO PATTERNS — must match client-side getWinningWays()
// ─────────────────────────────────────────────────────────────────────────────
const NORMAL_PATTERNS = [
    'Normal Bingo', 'Four Corners', 'Letter X', 'Letter T',
    'Letter L', 'Letter C', 'Plus Sign', 'Normal Bingo', 'Normal Bingo'
];

function randomPattern() {
    return NORMAL_PATTERNS[Math.floor(Math.random() * NORMAL_PATTERNS.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SCHEDULED DRAW CHECKER — runs every 1 minute
//    Checks gameState/schedules for due draws and starts the game.
//    Works 100% server-side — no browser needed.
// ─────────────────────────────────────────────────────────────────────────────
exports.scheduledDrawChecker = onSchedule(
    { schedule: 'every 1 minutes', timeZone: 'Asia/Manila' },
    async () => {
        const now     = Date.now();
        const schedSnap = await db.ref('gameState/schedules').once('value');
        const schedules = schedSnap.val();

        if (!schedules) return null;

        for (const [key, val] of Object.entries(schedules)) {
            const schedTime = typeof val === 'object' ? val.time : val;
            const isJP      = typeof val === 'object' && !!val.isJackpot;
            const jpAmt     = typeof val === 'object' ? (val.jackpotAmount || null) : null;

            if (typeof schedTime !== 'number') continue;
            // Only trigger within the 1-minute window
            if (now < schedTime || now >= schedTime + 65000) continue;

            // Remove schedule first (prevent double-trigger)
            await db.ref('gameState/schedules/' + key).remove();

            // Skip if winner already exists (game still running from another source)
            const winnerSnap = await db.ref('gameState/latestWinner').once('value');
            if (winnerSnap.exists()) {
                console.log(`[schedChecker] Skipping ${key} — winner already exists.`);
                continue;
            }

            // Skip if cloud draw already active
            const cfgSnap = await db.ref('gameState/drawConfig/cloudEnabled').once('value');
            if (cfgSnap.val() === true) {
                console.log(`[schedChecker] Skipping ${key} — cloud draw already active.`);
                continue;
            }

            // ── Clear board from previous game ──
            await Promise.all([
                db.ref('drawnNumbers').remove(),
                db.ref('gameState/winners').remove(),
                db.ref('gameState/lastCalled').remove(),
                db.ref('gameState/gameStartTime').remove(),
                db.ref('gameState/drawLock').remove(),
            ]);

            // Reset all users' hasWonCurrent flag
            const usersSnap = await db.ref('users').once('value');
            if (usersSnap.exists()) {
                const updates = {};
                usersSnap.forEach(u => { updates[u.key + '/hasWonCurrent'] = false; });
                await db.ref('users').update(updates);
            }

            // ── Set pattern & jackpot ──
            let pattern;
            if (isJP) {
                pattern = 'Blackout';
                await db.ref('gameState/jackpot').set({ amount: jpAmt, active: true });
            } else {
                pattern = randomPattern();
                await db.ref('gameState/jackpot').update({ active: false });
            }
            await db.ref('gameState/currentPattern').set(pattern);

            // ── Start Cloud Draw Engine ──
            await db.ref('gameState').update({ status: 'playing', gameStartTime: now });
            await db.ref('gameState/drawConfig').update({
                cloudEnabled: true,
                speed: 8000,        // 8 seconds per ball
                startedAt: now,
                lastDrawAt: now,
                triggeredBySchedule: key,
            });

            console.log(`[schedChecker] Started scheduled draw for key=${key}, pattern=${pattern}, isJP=${isJP}`);
        }

        return null;
    });


// ─────────────────────────────────────────────────────────────────────────────
// 2. CLOUD DRAW ENGINE — runs every 1 minute
//    Draws balls according to configured speed.
//    Handles winner detection, full-board detection, and auto-reset.
// ─────────────────────────────────────────────────────────────────────────────
exports.cloudDrawEngine = onSchedule(
    { schedule: 'every 1 minutes', timeZone: 'Asia/Manila' },
    async () => {
        // ── Check if cloud draw is active ──
        const cfgSnap = await db.ref('gameState/drawConfig').once('value');
        const cfg     = cfgSnap.val() || {};
        if (!cfg.cloudEnabled) return null;

        const speed     = cfg.speed || 8000;        // ms per ball
        const startedAt = cfg.startedAt || Date.now();
        const now       = Date.now();

        // ── Check for winner ──
        const winnerSnap = await db.ref('gameState/latestWinner').once('value');
        if (winnerSnap.exists()) {
            console.log('[drawEngine] Winner found — triggering auto-reset.');
            await triggerAutoReset(winnerSnap.val());
            return null;
        }

        // ── Get currently drawn numbers ──
        const drawnSnap = await db.ref('drawnNumbers').once('value');
        const drawnData = drawnSnap.val() || {};
        let drawnNums   = Object.values(drawnData).map(n => parseInt(n)).filter(n => !isNaN(n));

        if (drawnNums.length >= 75) {
            console.log('[drawEngine] All 75 balls drawn — auto-reset.');
            await triggerAutoReset(null);
            return null;
        }

        // ── Calculate how many balls should have been drawn by now ──
        const elapsed       = now - startedAt;
        const totalShould   = Math.floor(elapsed / speed) + 1;
        const ballsToDraw   = Math.min(totalShould - drawnNums.length, 8); // max 8 catch-up per tick

        console.log(`[drawEngine] drawn=${drawnNums.length}, should=${totalShould}, drawing=${ballsToDraw}`);

        for (let i = 0; i < ballsToDraw; i++) {
            // Re-check winner between each ball draw
            const wCheck = await db.ref('gameState/latestWinner').once('value');
            if (wCheck.exists()) {
                await triggerAutoReset(wCheck.val());
                return null;
            }
            if (drawnNums.length >= 75) {
                await triggerAutoReset(null);
                return null;
            }

            // Pick a unique random number 1–75
            let next, tries = 0;
            do {
                next = Math.floor(Math.random() * 75) + 1;
                tries++;
            } while (drawnNums.includes(next) && tries < 300);

            if (tries >= 300) break;

            await db.ref('drawnNumbers/' + next).set(next);
            await db.ref('gameState/lastCalled').set(next);
            await db.ref('gameState/drawConfig/lastDrawAt').set(Date.now());
            drawnNums.push(next);
        }

        return null;
    });


// ─────────────────────────────────────────────────────────────────────────────
// 3. WINNER TRIGGER — fires instantly when a winner is written
//    Handles auto-reset server-side with proper delay.
// ─────────────────────────────────────────────────────────────────────────────
exports.onWinnerFound = onValueCreated(
    { ref: 'gameState/latestWinner', region: 'asia-southeast1' },
    async (event) => {
        const winner = event.data.val();
        if (!winner) return null;

        console.log(`[onWinnerFound] Winner: ${winner.name} — scheduling reset in 10s...`);

        // Stop cloud draw
        await db.ref('gameState/drawConfig').update({ cloudEnabled: false });
        await db.ref('gameState/cloudDrawLock').remove();
        await db.ref('gameState/drawLock').remove();

        // Save to persistent lastGameWinner before reset
        await db.ref('gameState/lastGameWinner').set({
            ...winner,
            resetAt: Date.now() + 10000
        });

        // Wait 10 seconds then auto-reset
        await new Promise(r => setTimeout(r, 10000));
        await performReset();

        return null;
    });


// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Trigger auto-reset (stops draw, saves winner, clears board)
// ─────────────────────────────────────────────────────────────────────────────
async function triggerAutoReset(winner) {
    await db.ref('gameState/drawConfig').update({ cloudEnabled: false });
    await db.ref('gameState/cloudDrawLock').remove();
    await db.ref('gameState/drawLock').remove();

    if (winner) {
        await db.ref('gameState/lastGameWinner').set({
            ...winner,
            resetAt: Date.now() + 8000
        });
    }

    await new Promise(r => setTimeout(r, 8000));
    await performReset();
}

async function performReset() {
    // Get current winner one last time for lastGameWinner
    const wSnap = await db.ref('gameState/latestWinner').once('value');
    if (wSnap.exists()) {
        await db.ref('gameState/lastGameWinner').set({
            ...wSnap.val(),
            resetAt: Date.now()
        });
    }

    await Promise.all([
        db.ref('drawnNumbers').remove(),
        db.ref('gameState/latestWinner').remove(),
        db.ref('gameState/winners').remove(),
        db.ref('gameState/gameStartTime').remove(),
        db.ref('gameState/lastCalled').remove(),
    ]);

    await db.ref('gameState').update({ status: 'waiting' });

    // Reset hasWonCurrent for all users
    const usersSnap = await db.ref('users').once('value');
    if (usersSnap.exists()) {
        const updates = {};
        usersSnap.forEach(u => { updates[u.key + '/hasWonCurrent'] = false; });
        await db.ref('users').update(updates);
    }

    // Set next random pattern
    await db.ref('gameState/currentPattern').set(randomPattern());

    console.log('[performReset] Board cleared. Ready for next draw.');
}