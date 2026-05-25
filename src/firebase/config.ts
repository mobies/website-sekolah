import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
  apiKey: "AIzaSyBsfJTbtYSeDNC0ZL1GKeUGGaUlkv7hE18",
  authDomain: "website-mobies.firebaseapp.com",
  databaseURL: "https://website-mobies-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "website-mobies",
  storageBucket: "website-mobies.firebasestorage.app",
  messagingSenderId: "450211471424",
  appId: "1:450211471424:web:6f24b34d289490d62fbfa5",
  measurementId: "G-L424490L4W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
