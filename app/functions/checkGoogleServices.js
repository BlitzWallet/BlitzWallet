import {getApp} from '@react-native-firebase/app';

export function checkGooglePlayServices() {
  try {
    const app = getApp();

    console.log(app.utils());

    const areGoogleServicesEnabled =
      app.utils().playServicesAvailability.isAvailable;

    return areGoogleServicesEnabled;
  } catch (err) {
    console.log('Error getting google services information', err);
    return false;
  }
}
