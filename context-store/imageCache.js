import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import {getStorage} from '@react-native-firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import {useGlobalContacts} from './globalContacts';
import {useAppStatus} from './appStatus';

const BLITZ_PROFILE_IMG_STORAGE_REF = 'profile_pictures';
const FILE_DIR = FileSystem.cacheDirectory + 'profile_images/';

const ImageCacheContext = createContext();

export function ImageCacheProvider({children}) {
  const [cache, setCache] = useState({});
  const {didGetToHomepage} = useAppStatus();
  const {decodedAddedContacts} = useGlobalContacts();
  const didRunContextCacheCheck = useRef(null);

  console.log(cache, 'imgaes cache');

  useEffect(() => {
    (async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const imgKeys = keys.filter(k =>
          k.startsWith(BLITZ_PROFILE_IMG_STORAGE_REF),
        );
        const stores = await AsyncStorage.multiGet(imgKeys);
        const initialCache = {};
        stores.forEach(([key, value]) => {
          if (value) {
            const uuid = key.replace(BLITZ_PROFILE_IMG_STORAGE_REF + '/', '');
            const parsed = JSON.parse(value);
            initialCache[uuid] = parsed;
          }
        });
        setCache(initialCache);
      } catch (e) {
        console.error('Error loading image cache from storage', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!didGetToHomepage) return;
    if (didRunContextCacheCheck.current) return;
    didRunContextCacheCheck.current = true;
    console.log(decodedAddedContacts, 'DECIN FUNC');
    async function refreshContactsImages() {
      for (let index = 0; index < decodedAddedContacts.length; index++) {
        const element = decodedAddedContacts[index];
        await refreshCache(element.uuid);
      }
    }
    refreshContactsImages();
  }, [decodedAddedContacts, didGetToHomepage]);

  async function refreshCache(uuid, hasdownloadURL) {
    try {
      console.log('Refreshing image for', uuid);
      const key = `${BLITZ_PROFILE_IMG_STORAGE_REF}/${uuid}`;
      let url;
      let metadata;
      let updated;

      if (!hasdownloadURL) {
        const reference = getStorage().ref(
          `${BLITZ_PROFILE_IMG_STORAGE_REF}/${uuid}.jpg`,
        );

        metadata = await reference.getMetadata();
        updated = metadata.updated;

        const cached = cache[uuid];
        if (cached && cached.updated === updated) {
          const fileInfo = await FileSystem.getInfoAsync(cached.localUri);
          if (fileInfo.exists) return;
        }

        url = await reference.getDownloadURL();
      } else {
        url = hasdownloadURL;
        updated = new Date().toISOString();
      }

      const localUri = `${FILE_DIR}${uuid}.jpg`;

      await FileSystem.makeDirectoryAsync(FILE_DIR, {intermediates: true});
      await FileSystem.downloadAsync(url, localUri);

      const newCacheEntry = {
        uri: localUri,
        localUri,
        updated,
      };

      await AsyncStorage.setItem(key, JSON.stringify(newCacheEntry));
      setCache(prev => ({...prev, [uuid]: newCacheEntry}));

      return newCacheEntry;
    } catch (err) {
      console.log('Error refreshing image cache', err);
    }
  }

  async function removeProfileImageFromCache(uuid) {
    try {
      console.log('Deleting profile image', uuid);
      const key = `${BLITZ_PROFILE_IMG_STORAGE_REF}/${uuid}`;

      const newCacheEntry = {
        uri: null,
        localUri: null,
        updated: new Date().getTime(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(newCacheEntry));
      setCache(prev => ({...prev, [uuid]: newCacheEntry}));
      return newCacheEntry;
    } catch (err) {
      console.log('Error refreshing image cache', err);
    }
  }

  return (
    <ImageCacheContext.Provider
      value={{cache, refreshCache, removeProfileImageFromCache}}>
      {children}
    </ImageCacheContext.Provider>
  );
}

export function useImageCache() {
  return useContext(ImageCacheContext);
}
