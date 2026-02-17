// ============================================================
// firebase-messaging-sw.js
// ⚠️  I-lagay ito sa ROOT ng iyong website (kasama ng index.html)
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

// ============================================================
// BACKGROUND MESSAGE HANDLER
// Ito ang tatakbo kahit SARADO ang PWA app
// ============================================================
messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Background message received:', payload);

    // Support both notification + data payloads
    const title = (payload.notification && payload.notification.title)
        ? payload.notification.title
        : (payload.data && payload.data.title ? payload.data.title : 'Radio Bingo Live');

    const body = (payload.notification && payload.notification.body)
        ? payload.notification.body
        : (payload.data && payload.data.body ? payload.data.body : 'May bagong notification!');

    const type = (payload.data && payload.data.type) ? payload.data.type : 'general';
    const icon = 'https://i.imgur.com/7D8u8h6.png';

    // Different notification style per type
    const notificationOptions = {
        body: body,
        icon: icon,
        badge: icon,
        vibrate: [200, 100, 200, 100, 200],
        tag: type,          // Group same-type notifications
        renotify: true,     // Always show even if same tag
        requireInteraction: type === 'pm' || type === 'bingo', // Keep visible for messages & bingo
        data: {
            url: '/',
            type: type,
            payload: JSON.stringify(payload.data || {})
        },
        actions: type === 'pm'
            ? [{ action: 'reply', title: '💬 Buksan' }]
            : [{ action: 'open', title: '👀 Tingnan' }]
    };

    self.registration.showNotification(title, notificationOptions);
});

// ============================================================
// NOTIFICATION CLICK HANDLER
// Kapag na-tap ang notification sa phone
// ============================================================
self.addEventListener('notificationclick', function(event) {
    console.log('[firebase-messaging-sw.js] Notification click:', event.notification.tag);
    event.notification.close();

    const targetUrl = (event.notification.data && event.notification.data.url)
        ? event.notification.data.url
        : '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // Kung may bukas na tab, i-focus na lang
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            // Kung wala, magbukas ng bago
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// ============================================================
// PUSH EVENT FALLBACK
// Para sa mga browser na hindi fully suportado ang FCM SDK
// ============================================================
self.addEventListener('push', function(event) {
    if (event.data) {
        try {
            const data = event.data.json();
            const notification = data.notification || {};
            const notifData = data.data || {};

            const title = notification.title || notifData.title || 'Radio Bingo Live';
            const body = notification.body || notifData.body || 'May bagong update!';
            const icon = 'https://i.imgur.com/7D8u8h6.png';

            event.waitUntil(
                self.registration.showNotification(title, {
                    body: body,
                    icon: icon,
                    badge: icon,
                    vibrate: [200, 100, 200],
                    data: { url: '/' }
                })
            );
        } catch(e) {
            console.log('[SW] Push parse error:', e);
        }
    }
});
