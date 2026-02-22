// ============================================================
// firebase-messaging-sw.js
// I-lagay ito sa ROOT ng iyong project (kasama ng index.html)
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

// ✅ Background push handler — triggered kapag SARADO ang app
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background push received:', payload);

    const title = payload.notification?.title || payload.data?.title || 'Radio Bingo Live';
    const body  = payload.notification?.body  || payload.data?.body  || 'May bagong notification!';
    const icon  = payload.data?.icon  || 'https://i.imgur.com/7D8u8h6.png';
    const badge = payload.data?.badge || 'https://i.imgur.com/7D8u8h6.png';
    const url   = payload.data?.url   || '/';

    return self.registration.showNotification(title, {
        body,
        icon,
        badge,
        tag: payload.data?.tag || 'rb-notif',
        data: { url },
        vibrate: [200, 100, 200],
        requireInteraction: false
    });
});

// ✅ Click handler — i-open ang app kapag na-click ang notification
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Kung bukas na ang app, i-focus na lang
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Kung sarado, buksan
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
