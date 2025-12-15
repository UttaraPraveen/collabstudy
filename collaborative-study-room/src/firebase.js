import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// Your web app's Firebase configuration
// (You get this from the Firebase Console > Project Settings)
const firebaseConfig = {
  apiKey: "AIzaSyCslKLtlY1nEBm-IZNQND1UetSbzfJK1E0",
  authDomain: "collab-study-app-419b9.firebaseapp.com",
  projectId: "collab-study-app-419b9",
  storageBucket: "collab-study-app-419b9.firebasestorage.app",
  messagingSenderId: "65221881804",
  appId: "1:65221881804:web:8784c2ea84faf6651cb769"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth and export it
export const auth = getAuth(app);
export const db = getFirestore(app);