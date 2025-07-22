import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {BLITZ_PROFILE_IMG_STORAGE_REF} from '../constants';
import {getDownloadURL, getMetadata, ref} from '@react-native-firebase/storage';
import {storage} from '../../db/initializeFirebase';

const FILE_DIR = FileSystem.cacheDirectory + 'profileImages/';
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
    const cacheEntry = await AsyncStorage.getItem(key);
    const parsed = cacheEntry ? JSON.parse(cacheEntry) : null;

    if (parsed?.updated === updated) {
      const exists = await FileSystem.getInfoAsync(parsed.localUri);
      if (exists.exists)
        return {localUri: parsed.localUri, updated: parsed?.updated};
    }

    const url = await getDownloadURL(reference);
    await FileSystem.makeDirectoryAsync(FILE_DIR, {intermediates: true});
    const localUri = `${FILE_DIR}${uuid}.jpg`;

    await FileSystem.downloadAsync(url, localUri);
    const newEntry = {localUri, updated};
    await AsyncStorage.setItem(key, JSON.stringify(newEntry));

    return {localUri, updated};
  } catch (e) {
    console.log('Error caching profile image', e);
    return null;
  }
}
