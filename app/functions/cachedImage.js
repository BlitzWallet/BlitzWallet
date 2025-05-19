import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {BLITZ_PROFILE_IMG_STORAGE_REF} from '../constants';
import {getStorage} from '@react-native-firebase/storage';

const FILE_DIR = FileSystem.cacheDirectory + 'profileImages/';
const CACHE_KEY = uuid => `${BLITZ_PROFILE_IMG_STORAGE_REF}/${uuid}`;

export async function getCachedProfileImage(uuid) {
  try {
    const key = `${CACHE_KEY(uuid)}`;
    const ref = getStorage().ref(
      `${BLITZ_PROFILE_IMG_STORAGE_REF}/${uuid}.jpg`,
    );
    const metadata = await ref.getMetadata();
    const updated = metadata.updated;

    // Check for cached image info
    const cacheEntry = await AsyncStorage.getItem(key);
    const parsed = cacheEntry ? JSON.parse(cacheEntry) : null;

    if (parsed?.updated === updated) {
      const exists = await FileSystem.getInfoAsync(parsed.localUri);
      if (exists.exists)
        return {localUri: parsed.localUri, updated: parsed?.updated};
    }

    const url = await ref.getDownloadURL();
    await FileSystem.makeDirectoryAsync(FILE_DIR, {intermediates: true});
    const localUri = `${FILE_DIR}${uuid}.jpg`;

    await FileSystem.downloadAsync(url, localUri);
    const newEntry = {localUri, updated};
    await AsyncStorage.setItem(key, JSON.stringify(newEntry));

    return {localUri, updated};
  } catch (e) {
    console.error('Error caching profile image', e);
    return null;
  }
}
