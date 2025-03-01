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

// const initializeAppCheck = async () => {
//   const isInstalledViaPlaystore = await checkIfInstalledFromPlayStore();

//   if (Platform.OS === 'android' && !isInstalledViaPlaystore) {
//     try {
//       await initializeCustomAppCheck();
//     } catch (error) {
//       console.error('Custom App Check initialization failed', error);
//       throw error;
//     }
//   }

//   // Fallback to default Firebase App Check for Play Store installations
//   const provider = firebase.appCheck().newReactNativeFirebaseAppCheckProvider();
//   provider.configure({
//     android: {
//       provider: __DEV__ ? 'debug' : 'playIntegrity',
//       debugToken: __DEV__ ? process.env.FIREBSE_ANDROID_DEBUG_TOKEN : undefined,
//     },
//     apple: {
//       provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
//       debugToken: __DEV__ ? process.env.FIREBSE_IOS_DEBUG_TOKEN : undefined,
//     },
//     isTokenAutoRefreshEnabled: !__DEV__,
//   });

//   try {
//     await firebase.appCheck().initializeAppCheck({
//       provider,
//       isTokenAutoRefreshEnabled: true,
//     });
//     await firebase.appCheck().getToken(true);
//     console.log('Firebase App Check success');
//   } catch (error) {
//     console.log('Firebase App Check failed', error);
//   }
// };

// // Function to initialize App Check with custom token
// const initializeCustomAppCheck = async customToken => {
//   try {
//     // Initialize App Check with the custom token

//     const provider = firebase
//       .appCheck()
//       .newReactNativeFirebaseAppCheckProvider();
//     provider.configure({
//       android: {
//         provider: 'debug',
//         debugToken: process.env.FIREBSE_ANDROID_DEBUG_TOKEN,
//       },
//       isTokenAutoRefreshEnabled: true,
//     });

//     await firebase.appCheck().initializeAppCheck({
//       provider,
//       isTokenAutoRefreshEnabled: true, // Optional: Set to `true` to automatically refresh the token
//     });
//     await firebase.appCheck().getToken(true);
//     console.log('Custom App Check token obtained:');
//   } catch (error) {
//     console.error('Custom App Check initialization failed', error);
//     throw error;
//   }
// };

// const checkIfInstalledFromPlayStore = async () => {
//   const installerPackageName = await DeviceInfo.getInstallerPackageName();
//   if (installerPackageName === 'com.android.vending') {
//     console.log('App was installed through the Play Store.');
//     return true;
//   } else {
//     console.log('App was NOT installed through the Play Store.');
//     return false;
//   }
// };
