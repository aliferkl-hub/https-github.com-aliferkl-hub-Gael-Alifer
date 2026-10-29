/**
 * Firebase Client Initialization
 * Direct static import of firebase-applet-config.json
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleAuthProvider = new GoogleAuthProvider();

// Validate server connection on boot
export async function validateFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'settings', 'general'));
    return true;
  } catch (err) {
    console.warn('Firestore initial probe:', err);
    return false;
  }
}
