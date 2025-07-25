import {
  getDownloadURL,
  putFile,
  ref,
  deleteObject,
} from '@react-native-firebase/storage';
import {BLITZ_PROFILE_IMG_STORAGE_REF} from '../app/constants';
import {storage} from './initializeFirebase';

export async function setDatabaseIMG(publicKey, imgURL) {
  try {
    const reference = ref(
      storage,
      `${BLITZ_PROFILE_IMG_STORAGE_REF}/${publicKey}.jpg`,
    );

    await putFile(reference, imgURL.uri);

    const downloadURL = await getDownloadURL(reference);
    return downloadURL;
  } catch (err) {
    console.log('set database image error', err);
    return false;
  }
}
export async function deleteDatabaseImage(publicKey) {
  try {
    const reference = ref(
      storage,
      `${BLITZ_PROFILE_IMG_STORAGE_REF}/${publicKey}.jpg`,
    );

    await deleteObject(reference);
    return true;
  } catch (err) {
    console.log('delete profime imgage error', err);
    if (err.message.includes('No object exists at the desired reference')) {
      return true;
    }
    return false;
  }
}
