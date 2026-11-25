import { getUtils } from '@react-native-firebase/app';

export async function checkGooglePlayServices() {
  try {
    const status = await getUtils().getPlayServicesStatus();
    return status.isAvailable;
  } catch (err) {
    console.log('Error getting google services information', err);
    return false;
  }
}
