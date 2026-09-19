// Web shim for @react-native-firebase/app. On native, RNFB auto-initializes
// from google-services.json / plist. On web we must call initializeApp with
// the Firebase *web* app config, sourced from env. Placeholders let the build
// boot before real config is wired (M4); network calls fail until then.
import { initializeApp, getApp, getApps } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_WEB_API_KEY || 'placeholder',
  authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN || 'placeholder.firebaseapp.com',
  projectId: process.env.FIREBASE_WEB_PROJECT_ID || 'placeholder',
  storageBucket: process.env.FIREBASE_WEB_STORAGE_BUCKET || 'placeholder.appspot.com',
  messagingSenderId: process.env.FIREBASE_WEB_MESSAGING_SENDER_ID || '0',
  appId: process.env.FIREBASE_WEB_APP_ID || '1:0:web:placeholder',
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

// RNFB's utils().playServicesAvailability has no web meaning.
export function utils() {
  return { playServicesAvailability: { isAvailable: false } };
}

export { initializeApp, getApp, getApps };
export default { initializeApp, getApp, getApps, utils };
