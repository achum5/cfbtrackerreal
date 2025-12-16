import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCR0ahCPS5vZQbuRgRzh0EI5HNe6e2E-2Y",
  authDomain: "cfbtracker-200ab.firebaseapp.com",
  projectId: "cfbtracker-200ab",
  storageBucket: "cfbtracker-200ab.firebasestorage.app",
  messagingSenderId: "406010526116",
  appId: "1:406010526116:web:7be6a63fb683b1dd7ba931",
  measurementId: "G-P3PV4K9TYW"
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
