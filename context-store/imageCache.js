import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import {
  getDownloadURL,
  getMetadata,
  ref,
} from '@react-native-firebase/storage';
import { useGlobalContacts } from './globalContacts';
import { useAppStatus } from './appStatus';
import {
  BLITZ_PROFILE_IMG_STORAGE_REF,
  VALID_URL_REGEX,
} from '../app/constants';
import { useGlobalContextProvider } from './context';
import { getLocalStorageItem, setLocalStorageItem } from '../app/functions';
import { storage } from '../db/initializeFirebase';
import {
  cacheDirectory,
  copyAsync,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';
import {
  getAllLocalKeys,
  getMultipleItems,
} from '../app/functions/localStorage';
import { useSparkWallet } from './sparkContext';
const FILE_DIR = cacheDirectory + 'profile_images/';
const ImageCacheContext = createContext();

export function ImageCacheProvider({ children }) {
  const { sparkInformation } = useSparkWallet();
  const [cache, setCache] = useState({});
  const { didGetToHomepage } = useAppStatus();
  const { decodedAddedContacts } = useGlobalContacts();
  const { masterInfoObject } = useGlobalContextProvider();
  const didRunContextCacheCheck = useRef(null);

  const refreshCacheObject = async () => {
    try {
      const keys = await getAllLocalKeys();
      const imgKeys = keys.filter(k =>
        k.startsWith(BLITZ_PROFILE_IMG_STORAGE_REF),
      );
      const stores = await getMultipleItems(imgKeys);
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
    if (!sparkInformation.identityPubKey) return;
    didRunContextCacheCheck.current = true;

    async function refreshContactsImages() {
      // allways check all images, will return cahced image if its already cached. But this prevents against stale images
      let refreshArray = [
        ...decodedAddedContacts,
        { uuid: masterInfoObject.uuid },
      ];

      const cacheUpdates = {};
      for (let index = 0; index < refreshArray.length; index++) {
        const element = refreshArray[index];
        if (element.isLNURL) continue;
        const newCacheEntry = await refreshCache(element.uuid, null, true);
        if (newCacheEntry) {
          cacheUpdates[element.uuid] = newCacheEntry;
        }
      }

      if (Object.keys(cacheUpdates).length > 0) {
        setCache(prev => ({ ...prev, ...cacheUpdates }));
      }
    }
    refreshContactsImages();
  }, [
    decodedAddedContacts,
    didGetToHomepage,
    masterInfoObject?.uuid,
    sparkInformation.identityPubKey,
  ]);

  async function refreshCache(uuid, hasdownloadURL, skipCacheUpdate = false) {
    try {
      console.log('Refreshing image for', uuid);
      const key = `${BLITZ_PROFILE_IMG_STORAGE_REF}/${uuid}`;
      let url;
      let metadata;
      let updated;

      if (!hasdownloadURL) {
        const reference = ref(
          storage,
          `${BLITZ_PROFILE_IMG_STORAGE_REF}/${uuid}.jpg`,
        );

        metadata = await getMetadata(reference);
        updated = metadata.updated;

        const cached = cache[uuid];
        if (cached && cached.updated === updated) {
          const fileInfo = await getInfoAsync(cached.localUri);
          if (fileInfo.exists) return;
        }

        url = await getDownloadURL(reference);
      } else {
        url = hasdownloadURL;
        updated = new Date().toISOString();
      }

      const localUri = `${FILE_DIR}${uuid}.jpg`;

      await makeDirectoryAsync(FILE_DIR, { intermediates: true });

      if (VALID_URL_REGEX.test(url)) {
        console.log('Downloading image from', url, 'to', localUri);
        await downloadAsync(url, localUri);
      } else {
        console.log('Copying image from', url, 'to', localUri);
        await copyAsync({ from: url, to: localUri });
      }

      const newCacheEntry = {
        uri: localUri,
        localUri,
        updated,
      };

      await setLocalStorageItem(key, JSON.stringify(newCacheEntry));

      if (!skipCacheUpdate) {
        setCache(prev => ({ ...prev, [uuid]: newCacheEntry }));
      }

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

      await setLocalStorageItem(key, JSON.stringify(newCacheEntry));
      setCache(prev => ({ ...prev, [uuid]: newCacheEntry }));
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
