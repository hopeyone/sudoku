import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  signOut as fbSignOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

const env = import.meta.env;
const emulators = env.VITE_FIREBASE_EMULATORS === '1';

export const firebaseEnabled = !!(env.VITE_FIREBASE_PROJECT_ID || emulators);

let cached: FirebaseHandles | null = null;

export function getFirebase(): FirebaseHandles {
  if (cached) return cached;
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY || 'emulator-key',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'localhost',
    projectId: env.VITE_FIREBASE_PROJECT_ID || 'sudoku-emulator',
    appId: env.VITE_FIREBASE_APP_ID || 'emulator-app',
  });
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (emulators) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
  }
  cached = { app, auth, db };
  return cached;
}

export async function signInWithGoogle(): Promise<User> {
  const { auth } = getFirebase();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

// In emulator mode we allow anonymous sign-in so Playwright can drive the app
// without going through Google OAuth.
export async function signInAnonymouslyForEmulator(): Promise<User> {
  if (!emulators) throw new Error('Anonymous sign-in is only enabled with the emulator');
  const { auth } = getFirebase();
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function signOut(): Promise<void> {
  const { auth } = getFirebase();
  await fbSignOut(auth);
}

export const usingEmulators = emulators;
