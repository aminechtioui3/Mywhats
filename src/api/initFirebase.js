// src/api/firebase.init.js
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyBdddPAXX6TMVnsnfT2DRiAJYSTP8gmgc8",
    authDomain: "whatsapp-9243b.firebaseapp.com",
    projectId: "whatsapp-9243b",
    storageBucket: "whatsapp-9243b.firebasestorage.app",
    messagingSenderId: "928242319690",
    appId: "1:928242319690:web:12e9d5f55bba2431c601b3"
};

let app;
let auth;
let db;
let storage;

// Initialize Firebase only once
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);

    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });

    db = getFirestore(app);
    storage = getStorage(app);
} else {
    app = getApps()[0];
    // Don't reinitialize auth - get existing instance
    const { getAuth } = require('firebase/auth');
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
}

export { auth, db, storage, app };