// ============================================================
// functions/index.js
// Radio Bingo Live — Cloud Functions v1 (Push Notifications)
//
// SETUP:
//   1. cd functions
//   2. npm install
//   3. cd ..
//   4. firebase deploy --only functions
// ============================================================

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
admin.initializeApp();

const db = admin.database();

// ── Emoji map para sa notification types ────────────────────
const TYPE_EMOJI = {
    like:         '❤️',
    comment:      '💬',
    mention:      '@️',
    follow:       '👤',
    new_follower: '👤',
    pm:           '✉️',
    reaction:     '😮',
    bingo_win:    '🎉',
    coin:         '🪙',
    support:      '🛠️',
};

// ── Helper: build notification payload from notif object ─────
function buildPayload(notif) {
    const emoji = TYPE_EMOJI[notif.type] || '🔔';
    const title = notif.title || 'Radio Bingo Live';
    const body  = notif.msg  || 'May bagong notification!';

    return {
        notification: {
            title: `${emoji} ${title}`,
            body,
        },
        data: {
            title:   `${emoji} ${title}`,
            body,
            type:    notif.type  || 'general',
            tag:     notif.type  || 'general',  // collapses same-type notifs on device
            icon:    notif.image || 'https://i.imgur.com/7D8u8h6.png',
            url:     '/',
        },
        webpush: {
            headers: {
                Urgency: notif.type === 'pm' ? 'high' : 'normal',
            },
            notification: {
                icon:  notif.image || 'https://i.imgur.com/7D8u8h6.png',
                badge: 'https://i.imgur.com/7D8u8h6.png',
                requireInteraction: notif.type === 'pm', // PM stays until clicked
                vibrate: [200, 100, 200],
                tag: notif.type || 'general',
                renotify: true,
            },
        },
    };
}

// ============================================================
// TRIGGER: notifications/{uid}/{notifId}  onCreate
// Fires every time the client writes a new notification to RTDB
// ============================================================
exports.sendPushOnNotification = functions
    .region('asia-southeast1')           // Pinakamalapit sa PH
    .database.ref('notifications/{uid}/{notifId}')
    .onCreate(async (snapshot, context) => {
        const { uid } = context.params;
        const notif   = snapshot.val();

        if (!notif || !notif.msg) {
            console.log('Empty notification, skipping.');
            return null;
        }

        // ── Prevent self-notifications ───────────────────────
        if (notif.from && notif.from === uid) {
            console.log('Self-notification, skipping.');
            return null;
        }

        // ── Deduplication check ──────────────────────────────
        // Prevent double push when client writes the same notification twice
        // within a 10-second window (same from + type + postId)
        const dedupKey = [
            notif.from   || 'anon',
            notif.type   || 'general',
            notif.postId || 'none'
        ].join('_').replace(/[.#$/[\]]/g, '-');   // sanitize for RTDB key

        const dedupRef  = db.ref(`_notifDedup/${uid}/${dedupKey}`);
        const dedupSnap = await dedupRef.once('value');

        if (dedupSnap.exists()) {
            const lastSent = dedupSnap.val();
            const TEN_SECONDS = 10 * 1000;
            if (Date.now() - lastSent < TEN_SECONDS) {
                console.log(`⏭️ Duplicate notification skipped for ${uid} (${dedupKey})`);
                return null;
            }
        }

        // Mark as sent before sending to prevent race conditions
        await dedupRef.set(Date.now());

        // Auto-cleanup dedup entry after 30 seconds
        setTimeout(() => dedupRef.remove().catch(() => {}), 30000);

        // ── Get target user's FCM token ──────────────────────
        const userSnap = await db.ref(`users/${uid}/fcmToken`).once('value');
        const fcmToken = userSnap.val();

        if (!fcmToken) {
            console.log(`No FCM token for user ${uid}`);
            return null;
        }

        // ── Build and send the message ───────────────────────
        const payload = buildPayload(notif);
        payload.token = fcmToken;

        try {
            const response = await admin.messaging().send(payload);
            console.log(`✅ Push sent to ${uid}:`, response);
            return response;
        } catch (err) {
            // Token invalid / expired — clean it up from DB
            if (
                err.code === 'messaging/invalid-registration-token' ||
                err.code === 'messaging/registration-token-not-registered'
            ) {
                console.log(`🗑️ Stale token for ${uid}, removing.`);
                await db.ref(`users/${uid}/fcmToken`).remove();
            } else {
                console.error(`❌ Push failed for ${uid}:`, err);
            }
            return null;
        }
    });


// ============================================================
// TRIGGER: notifications/{uid}/{notifId}  onWrite (PM badge count)
// Updates unread PM badge count — optional but nice to have
// ============================================================
exports.updateUnreadCount = functions
    .region('asia-southeast1')
    .database.ref('notifications/{uid}/{notifId}')
    .onWrite(async (change, context) => {
        const { uid } = context.params;

        // Count unread PMs (read === false or undefined)
        const snap = await db.ref(`notifications/${uid}`).once('value');
        if (!snap.exists()) {
            await db.ref(`users/${uid}/unreadCount`).set(0);
            return null;
        }

        let unread = 0;
        snap.forEach(child => {
            const n = child.val();
            if (n && !n.read) unread++;
        });

        await db.ref(`users/${uid}/unreadCount`).set(unread);
        console.log(`Badge count for ${uid}: ${unread}`);
        return null;
    });


// ============================================================
// SCHEDULED: Every day 3 AM — purge notifications older than 30 days
// ============================================================
exports.cleanOldNotifications = functions
    .region('asia-southeast1')
    .pubsub.schedule('0 3 * * *')           // 3:00 AM daily
    .timeZone('Asia/Manila')
    .onRun(async () => {
        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago

        const usersSnap = await db.ref('notifications').once('value');
        if (!usersSnap.exists()) return null;

        const deletes = [];
        usersSnap.forEach(userNode => {
            userNode.forEach(notifNode => {
                const n = notifNode.val();
                if (n && n.time && n.time < cutoff) {
                    deletes.push(notifNode.ref.remove());
                }
            });
        });

        await Promise.all(deletes);
        console.log(`🗑️ Cleaned ${deletes.length} old notifications.`);
        return null;
    });


// ============================================================
// SCHEDULED: Every day 3 AM — purge stale FCM tokens
// (Tokens expire / rotate; keeps DB clean)
// ============================================================
exports.cleanStaleFcmTokens = functions
    .region('asia-southeast1')
    .pubsub.schedule('30 3 * * *')          // 3:30 AM daily
    .timeZone('Asia/Manila')
    .onRun(async () => {
        const usersSnap = await db.ref('users').once('value');
        if (!usersSnap.exists()) return null;

        const checks = [];
        usersSnap.forEach(userSnap => {
            const user = userSnap.val();
            if (!user || !user.fcmToken) return;

            const uid   = userSnap.key;
            const token = user.fcmToken;

            // Dry-run send to verify token validity
            const p = admin.messaging().send({ token, data: { ping: '1' } }, /* dryRun */ true)
                .then(() => null) // token ok
                .catch(async err => {
                    if (
                        err.code === 'messaging/invalid-registration-token' ||
                        err.code === 'messaging/registration-token-not-registered'
                    ) {
                        console.log(`🗑️ Removing stale token for ${uid}`);
                        await db.ref(`users/${uid}/fcmToken`).remove();
                    }
                });

            checks.push(p);
        });

        await Promise.all(checks);
        console.log(`✅ FCM token cleanup done.`);
        return null;
    });


// ============================================================
// TRIGGER: adminBroadcast/{broadcastId}  onCreate
// Admin writes here from dashboard → fans out to ALL users
// ============================================================
exports.sendBroadcastPush = functions
    .region('asia-southeast1')
    .database.ref('adminBroadcast/{broadcastId}')
    .onCreate(async (snapshot, context) => {
        const broadcast = snapshot.val();
        if (!broadcast || !broadcast.title || !broadcast.body) {
            console.log('Invalid broadcast, skipping.');
            return null;
        }

        console.log('Broadcasting push:', broadcast.title);

        // Fetch all users with FCM tokens
        const usersSnap = await db.ref('users').once('value');
        if (!usersSnap.exists()) return null;

        const tokens = [];
        usersSnap.forEach(userSnap => {
            const user = userSnap.val();
            if (user && user.fcmToken) {
                tokens.push(user.fcmToken);
            }
        });

        if (tokens.length === 0) {
            console.log('No FCM tokens found.');
            return null;
        }

        console.log(`Sending broadcast to ${tokens.length} users...`);

        // Firebase allows max 500 tokens per multicast
        const CHUNK_SIZE = 500;
        const chunks = [];
        for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
            chunks.push(tokens.slice(i, i + CHUNK_SIZE));
        }

        const icon = broadcast.icon || 'https://i.imgur.com/7D8u8h6.png';

        let totalSuccess = 0;
        let totalFail    = 0;
        const staleTokens = [];

        for (const chunk of chunks) {
            const message = {
                tokens: chunk,
                notification: {
                    title: broadcast.title,
                    body:  broadcast.body,
                },
                data: {
                    title: broadcast.title,
                    body:  broadcast.body,
                    type:  broadcast.type  || 'announcement',
                    tag:   broadcast.type  || 'announcement',
                    icon,
                    url: '/',
                },
                webpush: {
                    notification: {
                        icon,
                        badge: 'https://i.imgur.com/7D8u8h6.png',
                        vibrate: [200, 100, 200],
                        tag: broadcast.type || 'announcement',
                        renotify: true,
                    },
                },
            };

            try {
                const res = await admin.messaging().sendEachForMulticast(message);
                totalSuccess += res.successCount;
                totalFail    += res.failureCount;

                // Collect stale tokens
                res.responses.forEach((r, idx) => {
                    if (!r.success) {
                        const code = r.error && r.error.code;
                        if (
                            code === 'messaging/invalid-registration-token' ||
                            code === 'messaging/registration-token-not-registered'
                        ) {
                            staleTokens.push(chunk[idx]);
                        }
                    }
                });
            } catch (err) {
                console.error('Multicast chunk error:', err);
            }
        }

        console.log(`Broadcast done. Success: ${totalSuccess}, Failed: ${totalFail}`);

        // Update broadcast record with results
        await snapshot.ref.update({
            result: { sent: totalSuccess, failed: totalFail },
            completedAt: Date.now()
        });

        // Clean up stale tokens from DB
        if (staleTokens.length > 0) {
            console.log(`Removing ${staleTokens.length} stale tokens...`);
            const cleanups = [];
            usersSnap.forEach(userSnap => {
                const user = userSnap.val();
                if (user && staleTokens.includes(user.fcmToken)) {
                    cleanups.push(db.ref(`users/${userSnap.key}/fcmToken`).remove());
                }
            });
            await Promise.all(cleanups);
        }

        return null;
    });
