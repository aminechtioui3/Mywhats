// src/api/firebase.js
import 'react-native-url-polyfill/auto'; // required for Firebase JS SDK in React Native
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCPEkXj4yrq3NH5dxEToAEVLqySTIUE7ns",
  authDomain: "my-whatsapp-39c7c.firebaseapp.com",
  projectId: "my-whatsapp-39c7c",
  storageBucket: "my-whatsapp-39c7c.firebasestorage.app",
  messagingSenderId: "673335525008",
  appId: "1:673335525008:web:7b56e0b44c2ce5a72b6215",
};

// ---- App ----
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ---- Auth (React Native with AsyncStorage) ----
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (e) {
  auth = getAuth(app);
}

// ---- Firestore (React Native networking safe) ----
const db = initializeFirestore(app, {
  // force long-polling; avoids WebSocket issues that often cause "client is offline"
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});

// ---- Storage ----
const storage = getStorage(app);

export { app, auth, db, storage };
