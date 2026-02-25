// ============================================================
// firebase-messaging-sw.js
// I-lagay ito sa ROOT ng project (katabi ng index.html)
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
// Laging tinatawag ito dahil data-only ang messages natin.
// Kapag may "notification" field ang message, nilalampasan nito
// at ang browser na mismo ang mag-show — hindi consistent sa web.
messaging.onBackgroundMessage(payload => {
    console.log('[SW] Background push received:', payload);

    // Kunin mula sa data field (data-only message)
    const data  = payload.data || {};
    const title = data.title || '🎯 Radio Bingo Live';
    const body  = data.body  || 'May bagong notification!';
    const url   = data.url   || '/?tab=bingo';
    const tag   = data.tag   || 'rbl-notif';
    const requireInteraction = data.requireInteraction === 'true';

    // I-store ang FULL absolute URL para sa click handler
    const fullUrl = url.startsWith('http')
        ? url
        : self.location.origin + url;

    return self.registration.showNotification(title, {
        body,
        icon:  ICON,
        badge: BADGE,
        tag,
        renotify: true,
        requireInteraction,
        silent: false,
        data: { url: fullUrl },
        vibrate: [200, 100, 200],
        actions: [
            { action: 'open',    title: '👀 Buksan' },
            { action: 'dismiss', title: '✖ Dismiss' }
        ]
    });
});

// ── Notification click → navigate to correct page ─────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    const targetUrl = (event.notification.data && event.notification.data.url)
        ? event.notification.data.url
        : self.location.origin + '/?tab=bingo';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // Kung may bukas na tab ng app — i-navigate at i-focus
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin)) {
                    return client.navigate(targetUrl).then(c => c && c.focus());
                }
            }
            // Kung walang bukas na tab — mag-open ng bago
            return clients.openWindow(targetUrl);
        })
    );
});

// ── Push event fallback ────────────────────────────────────────
// Safety net: kapag hindi nag-trigger ang onBackgroundMessage
// (e.g. older browsers), ipapakita pa rin ang notification
self.addEventListener('push', event => {
    // Huwag mag-double-show kung nag-handle na ng Firebase messaging
    if (!event.data) return;

    let data = {};
    try { data = event.data.json(); } catch(e) { return; }

    // Kung may notification field, huwag na mag-show dito
    // (ibig sabihin, nag-handle na ang Firebase SDK)
    if (data.notification) return;

    // Para sa raw data-only push na hindi nakuha ng Firebase SDK
    const payload = data.data || data;
    const title   = payload.title || '🎯 Radio Bingo Live';
    const body    = payload.body  || 'May bagong notification!';
    const url     = payload.url   || '/?tab=bingo';
    const fullUrl = url.startsWith('http') ? url : self.location.origin + url;

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon:  ICON,
            badge: BADGE,
            tag:   payload.tag || 'rbl-notif',
            renotify: true,
            data: { url: fullUrl },
            vibrate: [200, 100, 200],
        })
    );
});