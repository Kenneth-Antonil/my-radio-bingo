/**
 * RADIO BINGO LIVE — Service Worker v4.2
 * =========================================================================
 * Push notifications are handled EXCLUSIVELY by firebase-messaging-sw.js
 * This SW handles only PWA install/activate lifecycle.
 *
 * ⚠️  DO NOT add push/FCM handling here — it will cause double notifications.
 */

// Install / Activate
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(clients.claim()));

// === MONETAG ===
self.options = {
    "domain": "3nbf4.com",
    "zoneId": 10725136
}
self.lary = ""
importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw')
