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

const { onSchedule }      = require('firebase-functions/v2/scheduler');
const { onValueCreated }  = require('firebase-functions/v2/database');
const admin               = require('firebase-admin');

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
// PUSH NOTIFICATION HELPER — sends to all users with a stored FCM token
// Silently cleans invalid/expired tokens from DB.
// ─────────────────────────────────────────────────────────────────────────────
async function sendPushToAll(title, body, data = {}) {
    try {
        const usersSnap = await db.ref('users').once('value');
        if (!usersSnap.exists()) return;

        const tokenMap = {};
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

        const BATCH = 500;
        for (let i = 0; i < tokens.length; i += BATCH) {
            const batch = tokens.slice(i, i + BATCH);

            const message = {
                tokens: batch,
                // DATA-ONLY — para laging dumaan sa SW onBackgroundMessage (reliable sa web)
                data: {
                    title,
                    body,
                    icon: 'https://i.imgur.com/7D8u8h6.png',
                    url:  data.url || '/?tab=bingo',
                    tag:  data.tag || 'rbl-game',
                    requireInteraction: data.requireInteraction || 'false',
                    ...Object.fromEntries(
                        Object.entries(data).map(([k, v]) => [k, String(v)])
                    ),
                },
                android: {
                    priority: 'high',
                    notification: {
                        title,
                        body,
                        sound:     'default',
                        channelId: 'radiobingo',
                        icon:      'notification_icon',
                    },
                },
                apns: {
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
// PUSH TO ONE USER — sends to a specific user's FCM token
// ─────────────────────────────────────────────────────────────────────────────
async function sendPushToUser(uid, title, body, data = {}) {
    try {
        const userSnap = await db.ref('users/' + uid).once('value');
        if (!userSnap.exists()) return;

        const token = userSnap.val().fcmToken;
        if (!token || typeof token !== 'string') {
            console.log(`[push] No FCM token for uid=${uid} — skipping.`);
            return;
        }

        const message = {
            token,
            data: {
                title,
                body,
                icon: 'https://i.imgur.com/7D8u8h6.png',
                url:  data.url || '/?tab=messenger',
                tag:  data.tag || 'rbl-msg',
                requireInteraction: 'false',
                ...Object.fromEntries(
                    Object.entries(data).map(([k, v]) => [k, String(v)])
                ),
            },
            android: {
                priority: 'high',
                notification: { title, body, sound: 'default', channelId: 'radiobingo' },
            },
            apns: {
                payload: {
                    aps: { alert: { title, body }, sound: 'default', badge: 1, 'content-available': 1 },
                },
            },
            webpush: {
                headers: { Urgency: 'high', TTL: '86400' },
                fcmOptions: { link: data.url || '/?tab=messenger' },
            },
        };

        const response = await messaging.send(message);
        console.log(`[push] Sent to uid=${uid}: ${response}`);

    } catch (err) {
        // Clean up invalid token
        const errCode = err && err.code;
        if (['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(errCode)) {
            await db.ref('users/' + uid + '/fcmToken').remove();
            console.log(`[push] Removed stale token for uid=${uid}`);
        } else {
            console.error(`[push] sendPushToUser error for uid=${uid}:`, err);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT TIME HELPER — "2:30 PM" format (Asia/Manila)
// ─────────────────────────────────────────────────────────────────────────────
function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-PH', {
        hour:     'numeric',
        minute:   '2-digit',
        hour12:   true,
        timeZone: 'Asia/Manila',
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// 1. SCHEDULED DRAW CHECKER — runs every 1 minute
//    • Sends push 10 mins before a draw
//    • Sends push 5 mins before a draw
//    • Starts the game when draw time is reached
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

            const minsUntil = (schedTime - now) / 60000;

            // ── 10-MINUTE WARNING ──────────────────────────────────────────
            if (minsUntil > 9.5 && minsUntil <= 10.5) {
                const flagRef  = db.ref(`gameState/notifSent/${key}_10min`);
                const flagSnap = await flagRef.once('value');
                if (!flagSnap.exists()) {
                    await flagRef.set(true);
                    const drawLabel = isJP
                        ? `Jackpot · ₱${(jpAmt || 0).toLocaleString()}`
                        : 'Regular Draw';
                    await sendPushToAll(
                        'Draw in 10 Minutes',
                        `${drawLabel} starts at ${formatTime(schedTime)}. Open your bingo card now.`,
                        { tag: 'rbl-10min', url: '/?tab=bingo' }
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
                        ? `Jackpot · ₱${(jpAmt || 0).toLocaleString()}`
                        : 'Regular Draw';
                    await sendPushToAll(
                        'Draw in 5 Minutes',
                        `${drawLabel} magsisimula na sa ${formatTime(schedTime)}. Get your bingo card ready.`,
                        { tag: 'rbl-5min', url: '/?tab=bingo', requireInteraction: 'true' }
                    );
                    console.log(`[schedChecker] 5-min push sent for key=${key}`);
                }
            }

            // ── DRAW TIME — start the game ─────────────────────────────────
            if (now < schedTime || now >= schedTime + 65000) continue;

            await db.ref('gameState/schedules/' + key).remove();
            await db.ref(`gameState/notifSent/${key}_10min`).remove();
            await db.ref(`gameState/notifSent/${key}_5min`).remove();

            const winnerSnap = await db.ref('gameState/latestWinner').once('value');
            if (winnerSnap.exists()) {
                console.log(`[schedChecker] Skipping ${key} — winner already exists.`);
                continue;
            }

            const cfgSnap = await db.ref('gameState/drawConfig/cloudEnabled').once('value');
            if (cfgSnap.val() === true) {
                console.log(`[schedChecker] Skipping ${key} — cloud draw already active.`);
                continue;
            }

            await Promise.all([
                db.ref('drawnNumbers').remove(),
                db.ref('gameState/winners').remove(),
                db.ref('gameState/lastCalled').remove(),
                db.ref('gameState/gameStartTime').remove(),
                db.ref('gameState/drawLock').remove(),
            ]);

            const usersSnap = await db.ref('users').once('value');
            if (usersSnap.exists()) {
                const updates = {};
                usersSnap.forEach(u => { updates[u.key + '/hasWonCurrent'] = false; });
                await db.ref('users').update(updates);
            }

            let pattern;
            if (isJP) {
                pattern = 'Blackout';
                await db.ref('gameState/jackpot').set({ amount: jpAmt, active: true });
            } else {
                pattern = randomPattern();
                await db.ref('gameState/jackpot').update({ active: false });
            }
            await db.ref('gameState/currentPattern').set(pattern);

            await db.ref('gameState').update({ status: 'playing', gameStartTime: now });
            await db.ref('gameState/drawConfig').update({
                cloudEnabled:          true,
                speed:                 8000,
                startedAt:             now,
                lastDrawAt:            now,
                triggeredBySchedule:   key,
            });

            const patternLabel = pattern === 'Blackout'
                ? `Blackout — Jackpot ₱${(jpAmt || 0).toLocaleString()}`
                : pattern;
            await sendPushToAll(
                'Draw is Starting',
                `Pattern: ${patternLabel}. Open the app and check your card.`,
                { tag: 'rbl-draw-start', url: '/?tab=bingo', requireInteraction: 'true' }
            );

            console.log(`[schedChecker] Started draw: key=${key}, pattern=${pattern}, isJP=${isJP}`);
        }

        return null;
    });


// ─────────────────────────────────────────────────────────────────────────────
// 2. CLOUD DRAW ENGINE — runs every 1 minute
// ─────────────────────────────────────────────────────────────────────────────
exports.cloudDrawEngine = onSchedule(
    { schedule: 'every 1 minutes', timeZone: 'Asia/Manila' },
    async () => {
        const cfgSnap = await db.ref('gameState/drawConfig').once('value');
        const cfg     = cfgSnap.val() || {};
        if (!cfg.cloudEnabled) return null;

        const speed     = cfg.speed || 8000;
        const startedAt = cfg.startedAt || Date.now();
        const now       = Date.now();

        const winnerSnap = await db.ref('gameState/latestWinner').once('value');
        if (winnerSnap.exists()) {
            console.log('[drawEngine] Winner found — triggering auto-reset.');
            await triggerAutoReset(winnerSnap.val());
            return null;
        }

        const drawnSnap = await db.ref('drawnNumbers').once('value');
        const drawnData = drawnSnap.val() || {};
        let drawnNums   = Object.values(drawnData).map(n => parseInt(n)).filter(n => !isNaN(n));

        if (drawnNums.length >= 75) {
            console.log('[drawEngine] All 75 balls drawn — auto-reset.');
            await sendPushToAll(
                'No Winner This Round',
                'All 75 balls drawn with no winner. Stay tuned for the next draw.',
                { tag: 'rbl-no-winner', url: '/?tab=bingo' }
            );
            await triggerAutoReset(null);
            return null;
        }

        const elapsed     = now - startedAt;
        const totalShould = Math.floor(elapsed / speed) + 1;
        const ballsToDraw = Math.min(totalShould - drawnNums.length, 8);

        console.log(`[drawEngine] drawn=${drawnNums.length}, should=${totalShould}, drawing=${ballsToDraw}`);

        for (let i = 0; i < ballsToDraw; i++) {
            const wCheck = await db.ref('gameState/latestWinner').once('value');
            if (wCheck.exists()) { await triggerAutoReset(wCheck.val()); return null; }
            if (drawnNums.length >= 75) {
                await sendPushToAll('No Winner This Round', 'All 75 balls drawn with no winner.', { tag: 'rbl-no-winner', url: '/?tab=bingo' });
                await triggerAutoReset(null);
                return null;
            }

            let next, tries = 0;
            do { next = Math.floor(Math.random() * 75) + 1; tries++; }
            while (drawnNums.includes(next) && tries < 300);
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
// ─────────────────────────────────────────────────────────────────────────────
exports.onWinnerFound = onValueCreated(
    { ref: 'gameState/latestWinner', region: 'asia-southeast1' },
    async (event) => {
        const winner = event.data.val();
        if (!winner) return null;

        console.log(`[onWinnerFound] Winner: ${winner.name} — sending push...`);

        await db.ref('gameState/drawConfig').update({ cloudEnabled: false });
        await db.ref('gameState/cloudDrawLock').remove();
        await db.ref('gameState/drawLock').remove();

        await db.ref('gameState/lastGameWinner').set({
            ...winner,
            resetAt: Date.now() + 10000
        });

        const winnerName    = winner.name    || 'A player';
        const winnerPattern = winner.pattern || 'Bingo';
        const prizeAmt      = winner.prize   ? ` · ₱${Number(winner.prize).toLocaleString()}` : '';
        const isJackpot     = winner.isJackpot || (winnerPattern === 'Blackout');

        await sendPushToAll(
            isJackpot ? 'Jackpot Winner!' : 'We Have a Winner!',
            `${winnerName} completed ${winnerPattern}${prizeAmt}. Next draw coming up soon.`,
            { tag: 'rbl-winner', url: '/?tab=bingo', requireInteraction: 'true' }
        );

        await new Promise(r => setTimeout(r, 10000));
        await performReset();

        return null;
    });


// ─────────────────────────────────────────────────────────────────────────────
// 4. ✉️  MESSAGE NOTIFICATION — fires instantly when a new PM is written
//    Sends a push notification ONLY to the recipient (hindi sa sender).
//    Path: messages/{messageId} with fields: from, to, text, image, timestamp
// ─────────────────────────────────────────────────────────────────────────────
exports.onNewMessage = onValueCreated(
    { ref: 'messages/{messageId}', region: 'asia-southeast1' },
    async (event) => {
        const msg = event.data.val();
        if (!msg || !msg.to || !msg.from) return null;

        const recipientUid = msg.to;
        const senderUid    = msg.from;

        // Don't notify if sender = recipient (shouldn't happen but safety check)
        if (recipientUid === senderUid) return null;

        // Get sender's name for the notification
        const senderSnap = await db.ref('users/' + senderUid).once('value');
        const sender     = senderSnap.val();
        if (!sender) return null;

        const senderName = sender.name || 'Someone';
        const msgPreview = msg.isSticker
            ? '(Sticker)'
            : msg.isVoice
            ? '(Voice note)'
            : msg.image
            ? '(Photo)'
            : (msg.text || '').substring(0, 100);

        console.log(`[onNewMessage] From ${senderName} → uid=${recipientUid}`);

        await sendPushToUser(
            recipientUid,
            senderName,
            msgPreview || 'Sent you a message',
            {
                tag: 'rbl-pm-' + senderUid,  // Group notifications per sender
                url: '/?tab=messenger',
                requireInteraction: 'false',
            }
        );

        return null;
    });


// ─────────────────────────────────────────────────────────────────────────────
// 5. 👥  GROUP MESSAGE NOTIFICATION — fires when a new group message is written
//    Sends push to all group members EXCEPT the sender.
//    Path: groupMessages/{groupId}/{messageId}
// ─────────────────────────────────────────────────────────────────────────────
exports.onNewGroupMessage = onValueCreated(
    { ref: 'groupMessages/{groupId}/{messageId}', region: 'asia-southeast1' },
    async (event) => {
        const msg     = event.data.val();
        const groupId = event.params.groupId;
        if (!msg || !msg.from || !groupId) return null;

        // Get group info
        const groupSnap = await db.ref('groups/' + groupId).once('value');
        const group     = groupSnap.val();
        if (!group || !group.members) return null;

        const senderUid  = msg.from;
        const senderName = msg.senderName || 'Someone';
        const groupName  = group.name || 'Group';
        const msgPreview = msg.isSticker ? '(Sticker)' : msg.isVoice ? '(Voice note)' : msg.image ? '(Photo)' : (msg.text || '').substring(0, 80);

        console.log(`[onNewGroupMessage] Group=${groupName}, From=${senderName}, Members=${Object.keys(group.members).length}`);

        // Send to all members except the sender
        const memberUids = Object.keys(group.members).filter(uid => uid !== senderUid);
        await Promise.all(memberUids.map(uid =>
            sendPushToUser(
                uid,
                `${groupName}`,
                `${senderName}: ${msgPreview || 'Sent a message'}`,
                {
                    tag: 'rbl-grp-' + groupId,
                    url: '/?tab=messenger',
                    requireInteraction: 'false',
                }
            )
        ));

        return null;
    });


// ─────────────────────────────────────────────────────────────────────────────
// 6. 💸  CASHOUT APPROVED PUSH — fires when admin approves a cashout
//    Sends a personal push notification to the specific user.
//    Path: userPush/{jobId}  fields: uid, title, body, timestamp, sent
// ─────────────────────────────────────────────────────────────────────────────
exports.onUserPushCreated = onValueCreated(
    { ref: 'userPush/{jobId}', region: 'asia-southeast1' },
    async (event) => {
        const job   = event.data.val();
        const jobId = event.params.jobId;
        if (!job || job.sent) return null;

        const { uid, title, body } = job;
        if (!uid || !title || !body) {
            await db.ref('userPush/' + jobId).update({ sent: true, error: 'Missing uid/title/body', processedAt: Date.now() });
            return null;
        }

        console.log(`[onUserPushCreated] Cashout push → uid=${uid}`);

        await sendPushToUser(uid, title, body, {
            tag: 'rbl-cashout',
            url: '/?tab=store',
            requireInteraction: 'true',
        });

        // Mark job as done
        await db.ref('userPush/' + jobId).update({ sent: true, processedAt: Date.now() });

        return null;
    });


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
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

    const usersSnap = await db.ref('users').once('value');
    if (usersSnap.exists()) {
        const updates = {};
        usersSnap.forEach(u => { updates[u.key + '/hasWonCurrent'] = false; });
        await db.ref('users').update(updates);
    }

    await db.ref('gameState/currentPattern').set(randomPattern());
    console.log('[performReset] Board cleared. Ready for next draw.');
}


// ─────────────────────────────────────────────────────────────────────────────
// 7. 🎯 PLAYER COUNT NOTIFICATIONS
//    Triggers when onlinePlayers/count changes (written by the client).
//    Sends push to ALL users when players are needed to start a draw.
//
//    Thresholds (same as _AUTO_START_MIN = 6 in client):
//      1 online → "5 kulang pa para mag-draw!"
//      2 online → "4 kulang pa para mag-draw!"
//      3 online → "3 kulang pa para mag-draw!"
//      4 online → "2 kulang pa para mag-draw!"
//      5 online → "1 player na lang kulang — malapit na!"
//
//    Anti-spam: 5-minute cooldown per count value via notifCooldown/playerCount
// ─────────────────────────────────────────────────────────────────────────────
const { onValueWritten } = require('firebase-functions/v2/database');

const AUTO_START_MIN = 6; // must match _AUTO_START_MIN in index.html

exports.notifyPlayersNeeded = onValueWritten(
    { ref: 'onlinePlayers/count', region: 'asia-southeast1' },
    async (event) => {
        const count = event.data.after.val();

        // Only fire when below threshold and game is not already playing
        if (count === null || count >= AUTO_START_MIN) return null;

        // Check if game is currently playing — don't send if so
        const statusSnap = await db.ref('gameState/status').once('value');
        if (statusSnap.val() === 'playing') return null;

        const needed = AUTO_START_MIN - count;

        // ── Cooldown: fire once per count value per 5 minutes ──
        const cooldownRef  = db.ref(`notifCooldown/playerCount/${count}`);
        const cooldownSnap = await cooldownRef.once('value');
        const lastFired    = cooldownSnap.val() || 0;
        const now          = Date.now();
        if (now - lastFired < 5 * 60 * 1000) {
            console.log(`[notifyPlayersNeeded] Cooldown active for count=${count} — skipping.`);
            return null;
        }
        await cooldownRef.set(now);

        // ── Build message ──
        let body;
        if (needed === 1) {
            body = '1 player na lang kulang para mag-draw — Sumali na ngayon! 🎯';
        } else {
            body = `${needed} players pa kulang para mag-draw! Imbitahan ang mga kaibigan! 🎰`;
        }

        console.log(`[notifyPlayersNeeded] count=${count}, needed=${needed} — sending push...`);

        await sendPushToAll(
            '🎲 RB Live Bingo — Kulang pa!',
            body,
            {
                tag:                'rbl-players-needed',
                url:                '/?tab=bingo',
                requireInteraction: 'false',
                count:              String(count),
            }
        );

        return null;
    }
);


// ─────────────────────────────────────────────────────────────────────────────
// 8. 🚨 COUNTDOWN STARTED NOTIFICATION
//    Fires when gameState/countdown/active becomes true.
//    Tells all users that the game is about to start — last chance to join!
//    Anti-spam: 2-minute cooldown.
// ─────────────────────────────────────────────────────────────────────────────
exports.notifyCountdownStarted = onValueWritten(
    { ref: 'gameState/countdown/active', region: 'asia-southeast1' },
    async (event) => {
        const active = event.data.after.val();
        if (!active) return null; // only fire when becoming true

        // Cooldown: max once every 2 minutes
        const cooldownRef  = db.ref('notifCooldown/countdown');
        const cooldownSnap = await cooldownRef.once('value');
        if (Date.now() - (cooldownSnap.val() || 0) < 2 * 60 * 1000) {
            console.log('[notifyCountdownStarted] Cooldown active — skipping.');
            return null;
        }
        await cooldownRef.set(Date.now());

        console.log('[notifyCountdownStarted] Countdown started — sending push...');

        await sendPushToAll(
            '🚨 RB Live Bingo — Magsisimula na!',
            'Sapat na ang players! Mag-JOIN na bago maging late! ⏱️',
            {
                tag:                'rbl-countdown',
                url:                '/?tab=bingo',
                requireInteraction: 'true',
            }
        );

        return null;
    }
);
