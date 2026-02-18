importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
    apiKey: "AIzaSyDIAQXJ15atKJxu7PtcFL1W9JnO1N14pVs",
    authDomain: "radiobingo-9ac29.firebaseapp.com",
    databaseURL: "https://radiobingo-9ac29-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "radiobingo-9ac29",
    storageBucket: "radiobingo-9ac29.firebasestorage.app",
    messagingSenderId: "965903993397",
    appId: "1:965903993397:web:f6646fa05225f147eebf7c"
});

const messaging = firebase.messaging();

// ============================================================
// CONSTANTS
// ============================================================
const APP_ICON  = 'https://i.imgur.com/7D8u8h6.png';
const APP_BADGE = 'https://i.imgur.com/7D8u8h6.png';
const APP_URL   = '/';

// ============================================================
// NOTIFICATION PROFILES
// Bawat type ay may sariling vibrate, actions, at behavior
// ============================================================
function getNotifProfile(type, data) {
    const profiles = {

        // PRIVATE MESSAGE — parang Messenger/Viber
        pm: {
            vibrate:            [100, 50, 100],
            requireInteraction: true,
            tag:                'pm-' + (data.senderUid || 'chat'),
            renotify:           true,
            actions: [
                { action: 'open',  title: '💬 Open'  },
                { action: 'close', title: '✕ Dismiss'  }
            ]
        },

        // BINGO CALL — pinaka-urgent
        bingo: {
            vibrate:            [300, 100, 300, 100, 300, 100, 300],
            requireInteraction: true,
            tag:                'bingo-call',
            renotify:           true,
            actions: [
                { action: 'open',  title: '🎱 Go to Game' },
                { action: 'close', title: '✕ Later'        }
            ]
        },

        // GAME STARTING SOON
        game_soon: {
            vibrate:            [200, 100, 200, 100, 200],
            requireInteraction: true,
            tag:                'game-soon',
            renotify:           true,
            actions: [
                { action: 'open',  title: '🎮 Join Now!' },
                { action: 'close', title: '✕ Dismiss'     }
            ]
        },

        // WIN / REWARD
        win: {
            vibrate:            [100, 50, 100, 50, 100, 50, 400],
            requireInteraction: true,
            tag:                'win-' + Date.now(),
            renotify:           true,
            actions: [
                { action: 'open',  title: '🏆 Claim Prize!' },
                { action: 'close', title: '✕ Dismiss'             }
            ]
        },

        // LIKE — hindi ganoon ka-urgent, inigrugrupo
        like: {
            vibrate:            [100],
            requireInteraction: false,
            tag:                'likes',
            renotify:           false,
            actions: [
                { action: 'open', title: '👀 View' }
            ]
        },

        // COMMENT
        comment: {
            vibrate:            [100, 50, 100],
            requireInteraction: false,
            tag:                'comments-' + (data.postKey || 'post'),
            renotify:           true,
            actions: [
                { action: 'open',  title: '💬 Reply' },
                { action: 'close', title: '✕ Dismiss'  }
            ]
        },

        // FOLLOW
        follow: {
            vibrate:            [100, 50, 100],
            requireInteraction: false,
            tag:                'follow-' + (data.senderUid || 'user'),
            renotify:           true,
            actions: [
                { action: 'open', title: '👤 View Profile' }
            ]
        },

        // COINS / POINTS
        coins: {
            vibrate:            [100, 50, 100, 50, 200],
            requireInteraction: false,
            tag:                'coins',
            renotify:           true,
            actions: [
                { action: 'open', title: '🪙 View Wallet' }
            ]
        },

        // PROMO / VOUCHER
        promo: {
            vibrate:            [200, 100, 200],
            requireInteraction: true,
            tag:                'promo-' + Date.now(),
            renotify:           true,
            actions: [
                { action: 'open',  title: '🎟️ Claim'  },
                { action: 'close', title: '✕ Later' }
            ]
        },

        // SYSTEM / ANNOUNCEMENT
        system: {
            vibrate:            [200, 100, 200],
            requireInteraction: false,
            tag:                'system',
            renotify:           true,
            actions: [
                { action: 'open', title: '📢 Read' }
            ]
        }
    };

    return profiles[type] || {
        vibrate:            [200, 100, 200],
        requireInteraction: false,
        tag:                'general-' + Date.now(),
        renotify:           true,
        actions: [
            { action: 'open', title: '🔔 Open App' }
        ]
    };
}

// ============================================================
// BACKGROUND MESSAGE HANDLER
// Tatakbo kahit SARADO o BACKGROUNDED ang app
// ============================================================
messaging.onBackgroundMessage(function(payload) {
    console.log('[SW] Background message:', payload);

    const n     = payload.notification || {};
    const d     = payload.data         || {};

    const title = n.title || d.title || '🎱 Radio Bingo Live';
    const body  = n.body  || d.body  || 'You have a new notification!';
    const type  = d.type  || 'system';
    const image = n.image || d.image  || null;

    const profile = getNotifProfile(type, d);

    return self.registration.showNotification(title, {
        body:               body,
        icon:               APP_ICON,
        badge:              APP_BADGE,
        image:              image,
        timestamp:          Date.now(),
        vibrate:            profile.vibrate,
        requireInteraction: profile.requireInteraction,
        tag:                profile.tag,
        renotify:           profile.renotify,
        silent:             false,
        actions:            profile.actions,
        data: {
            url:     d.url  || APP_URL,
            type:    type,
            payload: JSON.stringify(d)
        }
    });
});

// ============================================================
// NOTIFICATION CLICK — smart routing per type
// ============================================================
self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    if (event.action === 'close') return;

    const data = event.notification.data || {};
    const type = data.type || 'system';

    // Direkta sa tamang section ng app
    const routes = {
        pm:        '/?section=messages',
        bingo:     '/?section=bingo',
        game_soon: '/?section=bingo',
        win:       '/?section=store',
        like:      '/?section=social',
        comment:   '/?section=social',
        follow:    '/?section=profile',
        coins:     '/?section=store',
        promo:     '/?section=store'
    };

    const targetUrl = routes[type] || data.url || APP_URL;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus().then(c => { if ('navigate' in c) c.navigate(targetUrl); });
                }
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});

// ============================================================
// SW LIFECYCLE
// ============================================================
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(clients.claim()));
