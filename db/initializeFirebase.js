import {getAuth} from '@react-native-firebase/auth';
import {getFirestore} from '@react-native-firebase/firestore';
import {getFunctions} from '@react-native-firebase/functions';
import fetchBackend from './handleBackend';
const db = getFirestore();

export async function initializeFirebase(publicKey, privateKey) {
  try {
    // Initialize App Check first
    // Sign in anonymously
    // if (__DEV__) {
    //   getFunctions().useEmulator('localhost', 5001);
    // }

    const currentUser = getAuth().currentUser;
    console.log('current auth', {
      currentUser,
      publicKey,
    });

    if (currentUser && currentUser?.uid === publicKey) {
      return currentUser;
    }
    await getAuth().signInAnonymously();
    const isSignedIn = getAuth().currentUser;
    console.log(isSignedIn.uid, 'signed in');
    const token = await fetchBackend(
      'customToken',
      {userAuth: isSignedIn?.uid},
      privateKey,
      publicKey,
    );
    if (!token) throw new Error('Not able to get custom token from backend');
    console.log('custom sign in token from backend', token);
    await getAuth().signOut();

    const customSignIn = await getAuth().signInWithCustomToken(token);
    console.log('custom sign in user id', customSignIn.user);
    return customSignIn;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw new Error(String(error.message));
  }
}

export {db};
