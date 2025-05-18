import storage from '@react-native-firebase/storage';
import {BLITZ_PROFILE_IMG_STORAGE_REF} from '../constants';

export async function getImageURLFromDatabase(publicKey) {
  try {
    const reference = storage().ref(
      `${BLITZ_PROFILE_IMG_STORAGE_REF}/${publicKey}.jpg`,
    );
    const imageUrl = await reference.getDownloadURL();
    return imageUrl;
  } catch (err) {
    return false;
  }
}

export async function setDatabaseIMG(publicKey, imgURL) {
  try {
    const reference = storage().ref(
      `${BLITZ_PROFILE_IMG_STORAGE_REF}/${publicKey}.jpg`,
    );
    await reference.putFile(imgURL.uri);
    const imageUrl = await reference.getDownloadURL();

    return imageUrl;
  } catch (err) {
    return false;
  }
}
