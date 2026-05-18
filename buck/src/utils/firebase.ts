import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const buildSafeFirebaseConfig = {
  apiKey: "build-placeholder-api-key",
  authDomain: "buck-budget-tracker.local",
  databaseURL: "https://buck-budget-tracker.local",
  projectId: "buck-budget-tracker",
  storageBucket: "buck-budget-tracker.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000",
  measurementId: "G-0000000000",
};

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    buildSafeFirebaseConfig.apiKey,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    buildSafeFirebaseConfig.authDomain,
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    buildSafeFirebaseConfig.databaseURL,
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    buildSafeFirebaseConfig.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    buildSafeFirebaseConfig.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    buildSafeFirebaseConfig.messagingSenderId,
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    buildSafeFirebaseConfig.appId,
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ||
    buildSafeFirebaseConfig.measurementId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
