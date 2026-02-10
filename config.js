// config.js
const firebaseConfig = { 
    apiKey: "AIzaSyDIAQXJ15atKJxu7PtcFL1W9JnO1N14pVs", 
    authDomain: "radiobingo-9ac29.firebaseapp.com", 
    databaseURL: "https://radiobingo-9ac29-default-rtdb.asia-southeast1.firebasedatabase.app", 
    projectId: "radiobingo-9ac29", 
    storageBucket: "radiobingo-9ac29.firebasestorage.app", 
    messagingSenderId: "965903993397", 
    appId: "1:965903993397:web:f6646fa05225f147eebf7c" 
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const auth = firebase.auth();