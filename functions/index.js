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
