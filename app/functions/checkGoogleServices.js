import {getApp} from '@react-native-firebase/app';

export function checkGooglePlayServices() {
  const app = getApp();

  console.log(app.utils());

  const areGoogleServicesEnabled =
    app.utils().playServicesAvailability.isAvailable;

  return areGoogleServicesEnabled;
}
