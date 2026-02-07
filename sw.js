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

// BACKGROUND MESSAGE HANDLER (Kapag closed ang app)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Check if notification details exist, otherwise fallback to default
  const notificationTitle = payload.notification ? payload.notification.title : 'RB LIVE UPDATE';
  const notificationOptions = {
    body: payload.notification ? payload.notification.body : 'You have a new alert!',
    icon: payload.notification.icon || 'https://i.imgur.com/7D8u8h6.png', // Default icon
    badge: 'https://i.imgur.com/7D8u8h6.png', // Android badge
    vibrate: [200, 100, 200],
    requireInteraction: true, // Para hindi mawala agad sa screen
    data: {
        url: self.location.origin + '/index.html' // URL na bubuksan
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// EVENT: Kapag kinlick ng user ang notification sa phone
self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.');
  
  event.notification.close(); // Isara ang notif bar

  // Buksan ang app o mag-focus kung bukas na
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
      // Check kung may bukas na tab
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('index.html') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // Kung walang bukas, magbukas ng bago
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});
