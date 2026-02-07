importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

const CACHE_NAME = 'radio-bingo-final-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// --- FIREBASE CONFIG FOR BACKGROUND NOTIFICATIONS ---
// Kailangan ito dito para gumana ang notification kahit nakasara ang app
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

// Handler para sa background notifications (Closed App)
messaging.setBackgroundMessageHandler(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title || 'RB LIVE ALERT';
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg', // Default icon
    vibrate: [200, 100, 200]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
