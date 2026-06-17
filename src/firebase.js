import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD1eDVer4cG0yRT8oVBjTZZqyq9GRX7GfU",
  authDomain: "loonietrack-4c0d2.firebaseapp.com",
  projectId: "loonietrack-4c0d2",
  storageBucket: "loonietrack-4c0d2.firebasestorage.app",
  messagingSenderId: "286133198930",
  appId: "1:286133198930:web:3e39cf0ed4e28f9f1e3f8b"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const dbFs = getFirestore(app);