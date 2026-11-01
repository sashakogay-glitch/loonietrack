import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, indexedDBLocalPersistence } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";

const firebaseConfig = {
  apiKey: "AIzaSyD1eDVer4cG0yRT8oVBjTZZqyq9GRX7GfU",
  authDomain: "loonietrack-4c0d2.firebaseapp.com",
  projectId: "loonietrack-4c0d2",
  storageBucket: "loonietrack-4c0d2.firebasestorage.app",
  messagingSenderId: "286133198930",
  appId: "1:286133198930:web:3e39cf0ed4e28f9f1e3f8b"
};

export const app = initializeApp(firebaseConfig);

let plat = "";
try { plat = Capacitor.getPlatform(); } catch (e) {}

function makeAuth() {
  if (plat === "ios") {
    try {
      return initializeAuth(app, { persistence: indexedDBLocalPersistence });
    } catch (e) {}
  }
  return getAuth(app);
}

export const auth = makeAuth();

function makeDb() {
  if (plat !== "ios") {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
      });
    } catch (e) {}
  }
  return initializeFirestore(app, {});
}

export const dbFs = makeDb();
