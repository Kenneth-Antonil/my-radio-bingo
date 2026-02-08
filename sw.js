// Filename: sw.js
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

// Ito ang magha-handle ng message kapag naka-close o naka-minimize ang app
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || 'https://i.imgur.com/7D8u8h6.png', // Default icon kung wala sa payload
    badge: 'https://i.imgur.com/7D8u8h6.png',
    data: {
        url: payload.data?.url || '/' // Kunin ang URL mula sa data payload
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Ito ang magbubukas ng APP kapag kinlick ang notification
self.addEventListener('notificationclick', function(event) {
    console.log('Notification click received.');
    event.notification.close(); // Isara ang notification

    // Kunin ang URL na bubuksan (default sa root '/')
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
            // Kung bukas na ang tab, i-focus ito
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Kung walang bukas na tab, magbukas ng bago
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
