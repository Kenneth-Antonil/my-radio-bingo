importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

const firebaseConfig = { apiKey: "AIzaSyDIAQXJ15atKJxu7PtcFL1W9JnO1N14pVs", authDomain: "radiobingo-9ac29.firebaseapp.com", databaseURL: "https://radiobingo-9ac29-default-rtdb.asia-southeast1.firebasedatabase.app", projectId: "radiobingo-9ac29", storageBucket: "radiobingo-9ac29.firebasestorage.app", messagingSenderId: "965903993397", appId: "1:965903993397:web:f6646fa05225f147eebf7c" };

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://i.imgur.com/7D8u8h6.png'
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
