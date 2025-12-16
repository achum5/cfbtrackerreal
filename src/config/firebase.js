import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBBxY-0lKP0TVqFEk7VFacnN4T9Pva7dBc",
  authDomain: "cfbtracker-d0267.firebaseapp.com",
  projectId: "cfbtracker-d0267",
  storageBucket: "cfbtracker-d0267.firebasestorage.app",
  messagingSenderId: "658511021568",
  appId: "1:658511021568:web:afb9a069f09c38fd523ae5",
  measurementId: "G-K0SW03GE4Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Add scopes for Google Sheets and Drive access
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

export const db = getFirestore(app);

export default app;
