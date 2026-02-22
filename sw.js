/**
 * RADIO BINGO LIVE — Service Worker v4.0 (Blaze / Cloud Functions Edition)
 * =========================================================================
 * Push notifications are now handled SERVER-SIDE by Firebase Cloud Functions.
 * This SW only needs to:
 *   1. Receive FCM background messages and show OS notifications
 *   2. Handle notification clicks to open/focus the app
 */

importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
    apiKey:            'AIzaSyDIAQXJ15atKJxu7PtcFL1W9JnO1N14pVs',
    authDomain:        'radiobingo-9ac29.firebaseapp.com',
    databaseURL:       'https://radiobingo-9ac29-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId:         'radiobingo-9ac29',
    storageBucket:     'radiobingo-9ac29.firebasestorage.app',
    messagingSenderId: '965903993397',
    appId:             '1:965903993397:web:f6646fa05225f147eebf7c',
});

const messaging = firebase.messaging();
const APP_URL   = self.registration.scope;
const ICON      = 'https://i.imgur.com/7D8u8h6.png';

// Install / Activate
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(clients.claim()));

// FCM Background Message → show OS notification
// Fires when a push arrives and the app tab is NOT in the foreground.
messaging.onBackgroundMessage(payload => {
    const title = payload?.notification?.title || payload?.data?.title || '🎯 Radio Bingo Live';
    const body  = payload?.notification?.body  || payload?.data?.body  || 'May bagong update sa laro!';
    const url   = payload?.data?.url || APP_URL;

    return self.registration.showNotification(title, {
        body,
        icon:               ICON,
        badge:              ICON,
        vibrate:            [200, 100, 200, 100, 200],
        tag:                'rb-' + Date.now(),
        renotify:           true,
        requireInteraction: false,
        data:               { url },
        actions: [{ action: 'open', title: '🎴 Buksan ang App' }],
    });
});

// Notification click → open or focus app
self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = e.notification?.data?.url || APP_URL;
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            const existing = list.find(c => c.url.startsWith(APP_URL) && 'focus' in c);
            if (existing) return existing.focus();
            return clients.openWindow(url);
        })
    );
});
