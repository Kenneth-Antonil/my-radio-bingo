// ============================================================
// firebase-messaging-sw.js
// ============================================================

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

const ICON  = 'https://i.imgur.com/4nljOtR.png';
const BADGE = 'https://i.imgur.com/4nljOtR.png';

// ─────────────────────────────────────────────────────────────
// NOTIFICATION PROFILES
// ─────────────────────────────────────────────────────────────
function getProfile(tag, title, body, url) {
    const fullUrl = url.startsWith('http') ? url : self.location.origin + url;

    const base = {
        icon: ICON,
        badge: BADGE,
        tag,
        renotify: true,
        requireInteraction: false,
        silent: false,
        data: { url: fullUrl },
        vibrate: [150, 80, 150],
        actions: [
            { action: 'open',    title: 'Open App' },
            { action: 'dismiss', title: 'Dismiss'  }
        ]
    };

    if (tag === 'rbl-draw-start') {
        return {
            ...base,
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 400],
            actions: [
                { action: 'open',    title: '🎯 Play Now' },
                { action: 'dismiss', title: 'Later'       }
            ]
        };
    }

    if (tag === 'rbl-winner') {
        return {
            ...base,
            requireInteraction: true,
            vibrate: [300, 100, 300, 100, 300],
            actions: [
                { action: 'open',    title: '🎉 See Winner' },
                { action: 'dismiss', title: 'Close'         }
            ]
        };
    }

    if (tag === 'rbl-jackpot') {
        return {
            ...base,
            requireInteraction: true,
            vibrate: [400, 100, 400, 100, 400, 100, 400],
            actions: [
                { action: 'open',    title: '🏆 Join Now' },
                { action: 'dismiss', title: 'Skip'        }
            ]
        };
    }

    if (tag === 'rbl-10min') {
        return {
            ...base,
            requireInteraction: false,
            vibrate: [200, 100, 200],
            actions: [
                { action: 'open',    title: 'Get Ready' },
                { action: 'dismiss', title: 'Got It'    }
            ]
        };
    }

    if (tag === 'rbl-5min') {
        return {
            ...base,
            requireInteraction: false,
            vibrate: [300, 100, 300],
            actions: [
                { action: 'open',    title: 'Open Bingo Card' },
                { action: 'dismiss', title: 'Later'           }
            ]
        };
    }

    if (tag === 'rbl-no-winner') {
        return {
            ...base,
            requireInteraction: false,
            vibrate: [100],
            actions: [
                { action: 'open',    title: 'View Results' },
                { action: 'dismiss', title: 'Close'        }
            ]
        };
    }

    return base;
}

function cleanText(str) {
    return (str || '').trim();
}

// ─────────────────────────────────────────────────────────────
// BACKGROUND MESSAGE HANDLER (Firebase SDK — single handler)
// ─────────────────────────────────────────────────────────────
messaging.onBackgroundMessage(payload => {
    console.log('[SW] Background push received:', payload);

    const data  = payload.data || {};
    const title = cleanText(data.title) || 'Talim Connect';
    const body  = cleanText(data.body)  || 'You have a new notification.';
    const url   = data.url   || '/?tab=bingo';
    const tag   = data.tag   || 'rbl-notif';

    const profile = getProfile(tag, title, body, url);

    return self.registration.showNotification(title, {
        body,
        ...profile
    });
});

// ─────────────────────────────────────────────────────────────
// NOTIFICATION CLICK HANDLER
// ─────────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    const targetUrl = (event.notification.data && event.notification.data.url)
        ? event.notification.data.url
        : self.location.origin + '/?tab=bingo';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin)) {
                    return client.navigate(targetUrl).then(c => c && c.focus());
                }
            }
            return clients.openWindow(targetUrl);
        })
    );
});

// NOTE: Raw push fallback removed intentionally.
// Firebase SDK's onBackgroundMessage handles ALL FCM messages.
// Having both caused every notification to appear twice.