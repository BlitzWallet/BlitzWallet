import {BLITZ_PROFILE_IMG_STORAGE_REF} from '../constants';
import {getDownloadURL, getMetadata, ref} from '@react-native-firebase/storage';
import {storage} from '../../db/initializeFirebase';
import {
  cacheDirectory,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system';
import {getLocalStorageItem, setLocalStorageItem} from './localStorage';

const FILE_DIR = cacheDirectory + 'profileImages/';
const CACHE_KEY = uuid => `${BLITZ_PROFILE_IMG_STORAGE_REF}/${uuid}`;

export async function getCachedProfileImage(uuid) {
  try {
    const key = `${CACHE_KEY(uuid)}`;
    const reference = ref(
      storage,
      `${BLITZ_PROFILE_IMG_STORAGE_REF}/${uuid}.jpg`,
    );

    const metadata = await getMetadata(reference);
    const updated = metadata.updated;

    // Check for cached image info
    const cacheEntry = await getLocalStorageItem(key);
    const parsed = cacheEntry ? JSON.parse(cacheEntry) : null;

    if (parsed?.updated === updated) {
      const exists = await getInfoAsync(parsed.localUri);
      if (exists.exists)
        return {localUri: parsed.localUri, updated: parsed?.updated};
    }

    const url = await getDownloadURL(reference);

    await makeDirectoryAsync(FILE_DIR, {intermediates: true});
    const localUri = `${FILE_DIR}${uuid}.jpg`;

    await downloadAsync(url, localUri);
    const newEntry = {localUri, updated};
    await setLocalStorageItem(key, JSON.stringify(newEntry));

    return {localUri, updated};
  } catch (e) {
    console.log('Error caching profile image', e);
    return null;
  }
}
