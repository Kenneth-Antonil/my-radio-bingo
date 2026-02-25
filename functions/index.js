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
const db        = admin.database();
const messaging = admin.messaging();

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
// PUSH NOTIFICATION HELPER
// Sends a push to all users who have a stored FCM token.
// Silently skips invalid/expired tokens (cleans them from DB).
//
// @param title   string  — Notification title
// @param body    string  — Notification body
// @param data    object  — Extra key-value data (optional)
// ─────────────────────────────────────────────────────────────────────────────
async function sendPushToAll(title, body, data = {}) {
    try {
        const usersSnap = await db.ref('users').once('value');
        if (!usersSnap.exists()) return;

        // Collect all valid FCM tokens
        const tokenMap = {};   // token → uid
        usersSnap.forEach(u => {
            const token = u.val() && u.val().fcmToken;
            if (token && typeof token === 'string') {
                tokenMap[token] = u.key;
            }
        });

        const tokens = Object.keys(tokenMap);
        if (tokens.length === 0) {
            console.log('[push] No FCM tokens found — skipping.');
            return;
        }

        console.log(`[push] Sending "${title}" to ${tokens.length} device(s)...`);

        // Split into batches of 500 (FCM multicast limit)
        const BATCH = 500;
        for (let i = 0; i < tokens.length; i += BATCH) {
            const batch = tokens.slice(i, i + BATCH);

            // ── DATA-ONLY message ──────────────────────────────────────────
            // BAKIT: Kapag may "notification" field, ang browser mismo ang
            // nag-handle at nilalampasan ang Service Worker — unreliable sa web.
            // Data-only = laging dumadaan sa SW onBackgroundMessage = reliable.
            // ──────────────────────────────────────────────────────────────
            const message = {
                tokens: batch,
                // NO "notification" field — data-only para sa web
                data: {
                    title,
                    body,
                    icon: 'https://i.imgur.com/7D8u8h6.png',
                    url: data.url || '/?tab=bingo',
                    tag: data.tag || 'rbl-game',
                    requireInteraction: data.requireInteraction || 'false',
                    ...Object.fromEntries(
                        Object.entries(data).map(([k, v]) => [k, String(v)])
                    ),
                },
                android: {
                    priority: 'high',
                    // Android: kailangan ng notification block kahit data-only
                    // para lumabas sa notification tray
                    notification: {
                        title,
                        body,
                        sound: 'default',
                        channelId: 'radiobingo',
                        icon: 'notification_icon',
                    },
                },
                apns: {
                    // iOS: kailangan din ng notification block
                    payload: {
                        aps: {
                            alert: { title, body },
                            sound: 'default',
                            badge: 1,
                            'content-available': 1,
                        },
                    },
                },
                webpush: {
                    headers: { Urgency: 'high', TTL: '86400' },
                    // Web: walang notification block — SW na ang bahala
                    fcmOptions: { link: data.url || '/?tab=bingo' },
                },
            };

            const response = await messaging.sendEachForMulticast(message);
            console.log(`[push] Batch ${i / BATCH + 1}: success=${response.successCount}, fail=${response.failureCount}`);

            // Clean up bad tokens
            if (response.failureCount > 0) {
                const badUpdates = {};
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const errCode = resp.error && resp.error.code;
                        const isInvalid = [
                            'messaging/invalid-registration-token',
                            'messaging/registration-token-not-registered',
                        ].includes(errCode);
                        if (isInvalid) {
                            const uid = tokenMap[batch[idx]];
                            if (uid) {
                                badUpdates[uid + '/fcmToken'] = null;
                                console.log(`[push] Removed stale token for uid=${uid}`);
                            }
                        }
                    }
                });
                if (Object.keys(badUpdates).length > 0) {
                    await db.ref('users').update(badUpdates);
                }
            }
        }
    } catch (err) {
        console.error('[push] sendPushToAll error:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT TIME HELPER — "2:30 PM" format (Asia/Manila)
// ─────────────────────────────────────────────────────────────────────────────
function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila',
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// 1. SCHEDULED DRAW CHECKER — runs every 1 minute
//    • Sends push 10 mins before a draw
//    • Sends push 5 mins before a draw
//    • Starts the game when draw time is reached (push "NOW DRAWING")
// ─────────────────────────────────────────────────────────────────────────────
exports.scheduledDrawChecker = onSchedule(
    { schedule: 'every 1 minutes', timeZone: 'Asia/Manila' },
    async () => {
        const now       = Date.now();
        const schedSnap = await db.ref('gameState/schedules').once('value');
        const schedules = schedSnap.val();

        if (!schedules) return null;

        for (const [key, val] of Object.entries(schedules)) {
            const schedTime = typeof val === 'object' ? val.time : val;
            const isJP      = typeof val === 'object' && !!val.isJackpot;
            const jpAmt     = typeof val === 'object' ? (val.jackpotAmount || null) : null;

            if (typeof schedTime !== 'number') continue;

            const minsUntil = (schedTime - now) / 60000;    // float, can be negative

            // ── 10-MINUTE WARNING ──────────────────────────────────────────
            // Window: schedTime - 10min ±30s (so we don't skip if function fires late)
            if (minsUntil > 9.5 && minsUntil <= 10.5) {
                // Only send once — track with a flag in DB
                const flagRef  = db.ref(`gameState/notifSent/${key}_10min`);
                const flagSnap = await flagRef.once('value');
                if (!flagSnap.exists()) {
                    await flagRef.set(true);
                    const drawLabel = isJP
                        ? `🏆 JACKPOT DRAW — ₱${(jpAmt || 0).toLocaleString()}`
                        : '🎱 Regular Draw';
                    await sendPushToAll(
                        '⏰ 10 Minutes to Draw!',
                        `${drawLabel} magsisimula sa ${formatTime(schedTime)}. Mag-ready na!`,
                        { tag: 'rbl-countdown', url: '/?tab=bingo' }
                    );
                    console.log(`[schedChecker] 10-min push sent for key=${key}`);
                }
            }

            // ── 5-MINUTE WARNING ───────────────────────────────────────────
            else if (minsUntil > 4.5 && minsUntil <= 5.5) {
                const flagRef  = db.ref(`gameState/notifSent/${key}_5min`);
                const flagSnap = await flagRef.once('value');
                if (!flagSnap.exists()) {
                    await flagRef.set(true);
                    const drawLabel = isJP
                        ? `🏆 JACKPOT DRAW — ₱${(jpAmt || 0).toLocaleString()}`
                        : '🎱 Regular Draw';
                    await sendPushToAll(
                        '🔥 5 Minutes na lang!',
                        `${drawLabel} magsisimula na sa ${formatTime(schedTime)}. Huwag palampasin!`,
                        { tag: 'rbl-countdown', url: '/?tab=bingo', requireInteraction: 'true' }
                    );
                    console.log(`[schedChecker] 5-min push sent for key=${key}`);
                }
            }

            // ── DRAW TIME — start the game ─────────────────────────────────
            if (now < schedTime || now >= schedTime + 65000) continue;

            // Remove schedule first (prevent double-trigger)
            await db.ref('gameState/schedules/' + key).remove();
            // Clean up countdown notif flags for this schedule
            await db.ref(`gameState/notifSent/${key}_10min`).remove();
            await db.ref(`gameState/notifSent/${key}_5min`).remove();

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
                speed: 8000,
                startedAt: now,
                lastDrawAt: now,
                triggeredBySchedule: key,
            });

            // ── 🔔 NOW DRAWING push notification ──
            const patternLabel = pattern === 'Blackout'
                ? `Blackout / JACKPOT ₱${(jpAmt || 0).toLocaleString()}`
                : pattern;
            await sendPushToAll(
                '🎯 SIMULA NA! Drawing ngayon!',
                `Pattern: ${patternLabel} — Buksan ang app at i-check ang iyong card!`,
                { tag: 'rbl-draw-start', url: '/?tab=bingo', requireInteraction: 'true' }
            );

            console.log(`[schedChecker] Started draw: key=${key}, pattern=${pattern}, isJP=${isJP}`);
        }

        return null;
    });


// ─────────────────────────────────────────────────────────────────────────────
// SLEEP HELPER
// ─────────────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// 2. CLOUD DRAW ENGINE — runs every 1 minute
//    Draws balls one at a time with a real delay between each ball so
//    players see a smooth, evenly-spaced draw (default: every 5 seconds).
//
//    HOW IT WORKS:
//    • The function runs for up to ~55 seconds per invocation.
//    • It draws ONE ball, waits `speed` ms, draws the next, and so on.
//    • This replaces the old "burst-then-pause" approach where all missed
//      balls were drawn instantly at the start of each minute.
// ─────────────────────────────────────────────────────────────────────────────
exports.cloudDrawEngine = onSchedule(
    {
        schedule:  'every 1 minutes',
        timeZone:  'Asia/Manila',
        timeoutSeconds: 120,   // give enough room for the full draw loop
    },
    async () => {
        const cfgSnap = await db.ref('gameState/drawConfig').once('value');
        const cfg     = cfgSnap.val() || {};
        if (!cfg.cloudEnabled) return null;

        // ── Config ─────────────────────────────────────────────────────────
        const speed = cfg.speed || 5000;   // default: 5 seconds per ball

        // Max balls we can safely draw within 55 seconds (5s safety buffer).
        // Example: speed=5000 → 11 balls; speed=3000 → 18 balls.
        const MAX_PER_RUN = Math.floor(55000 / speed);

        // ── Check for winner ───────────────────────────────────────────────
        const winnerSnap = await db.ref('gameState/latestWinner').once('value');
        if (winnerSnap.exists()) {
            console.log('[drawEngine] Winner found — triggering auto-reset.');
            await triggerAutoReset(winnerSnap.val());
            return null;
        }

        // ── Get currently drawn numbers ────────────────────────────────────
        const drawnSnap = await db.ref('drawnNumbers').once('value');
        const drawnData = drawnSnap.val() || {};
        let drawnNums   = Object.values(drawnData).map(n => parseInt(n)).filter(n => !isNaN(n));

        if (drawnNums.length >= 75) {
            console.log('[drawEngine] All 75 balls drawn — auto-reset.');
            await sendPushToAll(
                '😔 Walang Nagwagi',
                'Nabasa na ang lahat ng 75 balls at walang nagbingo! Maghintay ng susunod na draw.',
                { tag: 'rbl-no-winner', url: '/?tab=bingo' }
            );
            await triggerAutoReset(null);
            return null;
        }

        console.log(`[drawEngine] Starting draw loop. drawn=${drawnNums.length}, speed=${speed}ms, maxPerRun=${MAX_PER_RUN}`);

        // ── Draw loop — one ball every `speed` ms ─────────────────────────
        for (let i = 0; i < MAX_PER_RUN; i++) {

            // Re-check winner before every ball
            const wCheck = await db.ref('gameState/latestWinner').once('value');
            if (wCheck.exists()) {
                console.log('[drawEngine] Winner detected mid-loop — stopping.');
                await triggerAutoReset(wCheck.val());
                return null;
            }

            if (drawnNums.length >= 75) {
                await sendPushToAll(
                    '😔 Walang Nagwagi',
                    'Nabasa na ang lahat ng 75 balls at walang nagbingo!',
                    { tag: 'rbl-no-winner', url: '/?tab=bingo' }
                );
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

            // Write ball to DB — client reacts to this in real-time
            await db.ref('drawnNumbers/' + next).set(next);
            await db.ref('gameState/lastCalled').set(next);
            await db.ref('gameState/drawConfig/lastDrawAt').set(Date.now());
            drawnNums.push(next);

            console.log(`[drawEngine] Drew ball #${next} (${drawnNums.length}/75). Waiting ${speed}ms...`);

            // ✅ THE KEY FIX: wait before drawing the next ball
            // This is what makes the draw feel smooth and even.
            await sleep(speed);
        }

        console.log(`[drawEngine] Run complete. Total drawn so far: ${drawnNums.length}/75`);
        return null;
    });


// ─────────────────────────────────────────────────────────────────────────────
// 3. WINNER TRIGGER — fires instantly when a winner is written
//    Sends winner push notification, then handles auto-reset.
// ─────────────────────────────────────────────────────────────────────────────
exports.onWinnerFound = onValueCreated(
    { ref: 'gameState/latestWinner', region: 'asia-southeast1' },
    async (event) => {
        const winner = event.data.val();
        if (!winner) return null;

        console.log(`[onWinnerFound] Winner: ${winner.name} — sending push & scheduling reset in 10s...`);

        // Stop cloud draw first
        await db.ref('gameState/drawConfig').update({ cloudEnabled: false });
        await db.ref('gameState/cloudDrawLock').remove();
        await db.ref('gameState/drawLock').remove();

        // Save to persistent lastGameWinner
        await db.ref('gameState/lastGameWinner').set({
            ...winner,
            resetAt: Date.now() + 10000
        });

        // ── 🔔 Winner push notification ──
        const winnerName    = winner.name    || 'Isang manlalaro';
        const winnerPattern = winner.pattern || 'Bingo';
        const prizeAmt      = winner.prize   ? ` — Premyo: ₱${Number(winner.prize).toLocaleString()}` : '';
        const isJackpot     = winner.isJackpot || (winnerPattern === 'Blackout');

        await sendPushToAll(
            isJackpot ? '🏆 JACKPOT WINNER!' : '🎉 BINGO! May Nagwagi!',
            `${winnerName} nag-${winnerPattern}${prizeAmt}! Congrats! Maghintay ng susunod na draw.`,
            { tag: 'rbl-winner', url: '/?tab=bingo', requireInteraction: 'true' }
        );

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