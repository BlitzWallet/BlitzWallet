import { getUtils } from '@react-native-firebase/app';

export function checkGooglePlayServices() {
  try {
    const areGoogleServicesEnabled =
      getUtils().playServicesAvailability.isAvailable;
    return areGoogleServicesEnabled;
  } catch (err) {
    console.log('Error getting google services information', err);
    return false;
  }
}
