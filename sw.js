importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

const firebaseConfig = {
    apiKey: "AIzaSyDIAQXJ15atKJxu7PtcFL1W9JnO1N14pVs",
    authDomain: "radiobingo-9ac29.firebaseapp.com",
    databaseURL: "https://radiobingo-9ac29-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "radiobingo-9ac29",
    storageBucket: "radiobingo-9ac29.firebasestorage.app",
    messagingSenderId: "965903993397",
    appId: "1:965903993397:web:f6646fa05225f147eebf7c"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// BACKGROUND HANDLER (Kapag closed ang app)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || 'https://i.imgur.com/7D8u8h6.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// NOTIFICATION CLICK HANDLER (Para bumukas ang app pag kinlick)
self.addEventListener('notificationclick', function(event) {
    console.log('Notification click received.');
    event.notification.close();

    // Buksan ang root URL ng app
    event.waitUntil(
        clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
            // Kung bukas na, i-focus lang
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // Kung hindi bukas, magbukas ng bago
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
