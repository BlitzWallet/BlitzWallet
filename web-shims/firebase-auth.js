// Web shim for @react-native-firebase/auth -> firebase/auth (name-identical
// modular API). Importing firebase-app first guarantees initializeApp ran.
import { getApp } from './firebase-app';
import { initializeAuth, inMemoryPersistence } from 'firebase/auth';
export * from 'firebase/auth';

// Session lives in memory only, so no refresh token sits in the browser profile
// for an infostealer/extension to lift (H-2). initializeFirebase re-mints it
// after unlock, when the account key is available. Must run before any
// getAuth() so getAuth returns this instance.
initializeAuth(getApp(), { persistence: inMemoryPersistence });

// Drop the refresh token persisted by builds before this change.
try {
  indexedDB.deleteDatabase('firebaseLocalStorageDb');
} catch {}
