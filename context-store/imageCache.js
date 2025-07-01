import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import {getStorage} from '@react-native-firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import {useGlobalContacts} from './globalContacts';
import {useAppStatus} from './appStatus';
import {BLITZ_PROFILE_IMG_STORAGE_REF} from '../app/constants';
import {useGlobalContextProvider} from './context';
import {getLocalStorageItem, setLocalStorageItem} from '../app/functions';
const FILE_DIR = FileSystem.cacheDirectory + 'profile_images/';

const ImageCacheContext = createContext();

export function ImageCacheProvider({children}) {
  const [cache, setCache] = useState({});
  const {didGetToHomepage} = useAppStatus();
  const {decodedAddedContacts} = useGlobalContacts();
  const {masterInfoObject} = useGlobalContextProvider();
  const didRunContextCacheCheck = useRef(null);

  console.log(cache, 'imgaes cache');

  const refreshCacheObject = async () => {
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
  };

  useEffect(() => {
    refreshCacheObject();
  }, [decodedAddedContacts]); //rerun the cache when adding or removing contacts

  useEffect(() => {
    if (!didGetToHomepage) return;
    if (didRunContextCacheCheck.current) return;
    if (!masterInfoObject.uuid) return;
    didRunContextCacheCheck.current = true;
    async function refreshContactsImages() {
      const didCheckForProfileImage = await getLocalStorageItem(
        'didCheckForProfileImage',
      );

      let refreshArray = [...decodedAddedContacts];
      if (didCheckForProfileImage !== 'true') {
        refreshArray.push({uuid: masterInfoObject.uuid});
        setLocalStorageItem('didCheckForProfileImage', 'true');
      }
      for (let index = 0; index < refreshArray.length; index++) {
        const element = refreshArray[index];
        if (element.isLNURL) continue;
        await refreshCache(element.uuid);
      }
    }
    refreshContactsImages();
  }, [decodedAddedContacts, didGetToHomepage, masterInfoObject?.uuid]);

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

  const contextValue = useMemo(
    () => ({
      cache,
      refreshCache,
      removeProfileImageFromCache,
      refreshCacheObject,
    }),
    [cache, refreshCache, removeProfileImageFromCache, refreshCacheObject],
  );

  return (
    <ImageCacheContext.Provider value={contextValue}>
      {children}
    </ImageCacheContext.Provider>
  );
}

export function useImageCache() {
  return useContext(ImageCacheContext);
}
