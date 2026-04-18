import { utils } from '@react-native-firebase/app';

export function checkGooglePlayServices() {
  try {
    const areGoogleServicesEnabled =
      utils().playServicesAvailability.isAvailable;
    return areGoogleServicesEnabled;
  } catch (err) {
    console.log('Error getting google services information', err);
    return false;
  }
}
