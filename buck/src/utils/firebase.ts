import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB56EuvAelTGSfR7ACH40Z6-NdoK7Dk8BU",
  authDomain: "buck-the-budget-tracker.firebaseapp.com",
  databaseURL: "https://buck-the-budget-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "buck-the-budget-tracker",
  storageBucket: "buck-the-budget-tracker.firebasestorage.app",
  messagingSenderId: "1022326164601",
  appId: "1:1022326164601:web:2c212472fafbfba07b58a8",
  measurementId: "G-975YN12X3J"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);