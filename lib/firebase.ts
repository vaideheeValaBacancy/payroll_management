import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBmpCz6tBzD1IRfHeeGw7Tg7Rlw4V-tprU",
  authDomain: "paymentmanagement-c4971.firebaseapp.com",
  projectId: "paymentmanagement-c4971",
  storageBucket: "paymentmanagement-c4971.firebasestorage.app",
  messagingSenderId: "878080272822",
  appId: "1:878080272822:web:7fbccbaf911b266525f917"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
