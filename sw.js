/**
 * RADIO BINGO LIVE — Service Worker v4.1
 * =========================================================================
 * Push notifications are handled SERVER-SIDE by Firebase Cloud Functions.
 * This SW:
 *   1. Receives FCM background messages and shows OS notifications
 *   2. Handles notification clicks to open/focus the app
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
messaging.onBackgroundMessage(payload => {
    const data  = payload.data || {};
    const title = data.title || payload?.notification?.title || 'Radio Bingo Live';
    const body  = data.body  || payload?.notification?.body  || 'May bagong update!';
    const url   = data.url   || APP_URL;
    const tag   = data.tag   || 'rbl-notif';

    return self.registration.showNotification(title, {
        body,
        icon:               ICON,
        badge:              ICON,
        vibrate:            [200, 100, 200, 100, 200],
        tag:                tag,
        renotify:           true,
        requireInteraction: data.requireInteraction === 'true',
        data:               { url },
        actions: [
            { action: 'open',    title: 'Buksan' },
            { action: 'dismiss', title: 'Dismiss' }
        ],
    });
});

// Notification click → open or focus app
self.addEventListener('notificationclick', e => {
    e.notification.close();
    if (e.action === 'dismiss') return;

    const url = (e.notification.data && e.notification.data.url) || APP_URL;
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            const existing = list.find(c => c.url.startsWith(APP_URL) && 'focus' in c);
            if (existing) return existing.navigate(url).then(c => c && c.focus());
            return clients.openWindow(url);
        })
    );
});

// Raw push fallback (older browsers / non-FCM)
self.addEventListener('push', event => {
    if (!event.data) return;
    let data = {};
    try { data = event.data.json(); } catch(e) { return; }
    if (data.notification) return; // Firebase SDK already handled it

    const payload = data.data || data;
    const title   = payload.title || 'Radio Bingo Live';
    const body    = payload.body  || 'May bagong update!';
    const url     = payload.url   || APP_URL;
    const tag     = payload.tag   || 'rbl-notif';

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon:  ICON,
            badge: ICON,
            tag,
            renotify: true,
            data: { url },
            actions: [{ action: 'open', title: 'Buksan' }],
        })
    );
});