import {getStorage} from '@react-native-firebase/storage';
import {BLITZ_PROFILE_IMG_STORAGE_REF} from '../app/constants';

export async function setDatabaseIMG(publicKey, imgURL) {
  try {
    const reference = getStorage().ref(
      `${BLITZ_PROFILE_IMG_STORAGE_REF}/${publicKey}.jpg`,
    );

    await reference.putFile(imgURL.uri);

    const downloadURL = await reference.getDownloadURL();
    return downloadURL;
  } catch (err) {
    console.log('set database image error', err);
    return false;
  }
}
export async function deleteDatabaseImage(publicKey) {
  try {
    const reference = getStorage().ref(
      `${BLITZ_PROFILE_IMG_STORAGE_REF}/${publicKey}.jpg`,
    );
    await reference.delete();
    return true;
  } catch (err) {
    console.log('delete profime imgage error', err);
    if (err.message.includes('No object exists at the desired reference')) {
      return true;
    }
    return false;
  }
}
