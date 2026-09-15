// Web shim for @react-native-firebase/auth -> firebase/auth (name-identical
// modular API). Importing firebase-app first guarantees initializeApp ran.
import './firebase-app';
export * from 'firebase/auth';
