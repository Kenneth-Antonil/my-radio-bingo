// ============================================================
// firebase-messaging-sw.js
// I-REPLACE ang laman ng existing firebase-messaging-sw.js mo
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ⚠️ I-PASTE ang Firebase config mo dito
firebase.initializeApp({
  apiKey: "AIzaSyDIAQXJ15atKJxu7PtcFL1W9JnO1N14pVs",
  authDomain: "radiobingo-9ac29.firebaseapp.com",
  databaseURL: "https://radiobingo-9ac29-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "radiobingo-9ac29",
  storageBucket: "radiobingo-9ac29.firebasestorage.app",
  messagingSenderId: "965903993397",
  appId: "1:965903993397:web:f6646fa05225f147eebf7c",
  measurementId: "G-RR2EG93C43"

});

const messaging = firebase.messaging();

// ----------------------------------------------------------
// BACKGROUND NOTIFICATIONS
// Tinatawag ito kapag NAKASARA o NAKA-BACKGROUND ang app
// ----------------------------------------------------------
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const notificationData = payload.notification || {};
  const extraData       = payload.data || {};

  const title   = notificationData.title || '📣 Radio Bingo';
  const options = {
    body:               notificationData.body || '',
    icon:               notificationData.icon || '/icon-192x192.png',
    badge:              '/icon-192x192.png',
    image:              notificationData.image  || null,
    vibrate:            [200, 100, 200, 100, 200],
    requireInteraction: false,
    tag:                extraData.type || 'general',   // prevents duplicate notifs of same type
    renotify:           true,
    data: {
      url:  extraData.url  || '/',
      type: extraData.type || 'general'
    },
    actions: getActions(extraData.type)
  };

  return self.registration.showNotification(title, options);
});

// ----------------------------------------------------------
// NOTIFICATION CLICK HANDLER
// ----------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Kung may bukas na tab, i-focus na lang
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if (client.navigate) client.navigate(url);
          return;
        }
      }
      // Walang bukas na tab — mag-open ng bago
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ----------------------------------------------------------
// HELPER: Notification action buttons base sa type
// ----------------------------------------------------------
function getActions(type) {
  switch (type) {
    case 'friend_request':
      return [
        { action: 'accept', title: '✅ Accept' },
        { action: 'ignore', title: '❌ Ignore' }
      ];
    case 'draw_reminder':
      return [
        { action: 'open', title: '🎯 Join Now' }
      ];
    case 'new_message':
      return [
        { action: 'open', title: '💬 Reply' }
      ];
    default:
      return [];
  }
}
