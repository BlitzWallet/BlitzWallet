import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import fetchBackend from './handleBackend';
const db = firestore();

export async function initializeFirebase(publicKey, privateKey) {
  try {
    // Initialize App Check first
    // Sign in anonymously
    if (__DEV__) {
      functions().useEmulator('localhost', 5001);
    }

    const currentUser = auth().currentUser;
    console.log('current auth', {
      currentUser,
      publicKey,
    });

    if (currentUser && currentUser?.uid === publicKey) {
      return currentUser;
    }
    await auth().signInAnonymously();
    const isSignedIn = auth().currentUser;
    console.log(isSignedIn.uid, 'signed in');
    const token = await fetchBackend(
      'customToken',
      {userAuth: isSignedIn?.uid},
      privateKey,
      publicKey,
    );
    if (!token) throw new Error('Not able to get custom token from backend');
    console.log('custom sign in token from backend', token);
    await auth().signOut();

    const customSignIn = await auth().signInWithCustomToken(token);
    console.log('custom sign in user id', customSignIn.user);
    return customSignIn;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw new Error(String(error.message));
  }
}

export {db};
