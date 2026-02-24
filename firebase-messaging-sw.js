// ============================================================
// firebase-messaging-sw.js
// I-lagay ito sa ROOT ng project (katabi ng index.html)
// Handles background push notifications (app closed / tab hidden)
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

const ICON  = 'https://i.imgur.com/7D8u8h6.png';
const BADGE = 'https://i.imgur.com/7D8u8h6.png';

// ── Handle background push messages ──────────────────────────
messaging.onBackgroundMessage(payload => {
    console.log('[SW] Background push received:', payload);

    const data  = payload.data || {};
    const title = data.title || payload.notification?.title || '🎯 Radio Bingo Live';
    const body  = data.body  || payload.notification?.body  || 'May bagong notification!';
    const icon  = data.icon  || ICON;
    const url   = data.url   || '/index.html';

    return self.registration.showNotification(title, {
        body,
        icon,
        badge: BADGE,
        tag: data.tag || 'rbl-notif',
        renotify: true,
        requireInteraction: data.requireInteraction === 'true',
        // ← IMPORTANT: i-store ang FULL url dito para magamit sa click handler
        data: { url: url.startsWith('http') ? url : (self.location.origin + url) },
        vibrate: [200, 100, 200],
        actions: [
            { action: 'open',    title: '👀 Buksan' },
            { action: 'dismiss', title: 'Dismiss'   }
        ]
    });
});

// ── Notification click handler ────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();

    // Dismiss button — wala nang gagawin
    if (event.action === 'dismiss') return;

    // Kunin ang target URL na naka-store sa notification data
    const targetUrl = (event.notification.data && event.notification.data.url)
        ? event.notification.data.url
        : self.location.origin + '/?tab=bingo';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {

            // ── Kung may bukas na tab ng app ──────────────────
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin)) {
                    // I-navigate ang existing tab papunta sa tamang URL
                    // tapos i-focus para lumabas sa harap
                    return client.navigate(targetUrl).then(c => c && c.focus());
                }
            }

            // ── Kung walang bukas na tab — mag-open ng bago ──
            return clients.openWindow(targetUrl);
        })
    );
});