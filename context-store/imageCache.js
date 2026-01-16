import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
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
  const cachedImagesRef = useRef(cache);

  const inFlightRequests = useRef(new Map());

  const refreshCacheObject = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    cachedImagesRef.current = cache;
  }, [cache]);

  useEffect(() => {
    refreshCacheObject();
  }, [decodedAddedContacts, refreshCacheObject]); //rerun the cache when adding or removing contacts

  const refreshCache = useCallback(
    async (uuid, hasdownloadURL, skipCacheUpdate = false) => {
      if (inFlightRequests.current.has(uuid)) {
        console.log('Request already in flight for', uuid);
        return inFlightRequests.current.get(uuid);
      }
      const requestPromise = (async () => {
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
              if (fileInfo.exists) return cached;
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
          throw err;
        } finally {
          inFlightRequests.current.delete(uuid);
        }
      })();

      inFlightRequests.current.set(uuid, requestPromise);

      return requestPromise;
    },
    [cache],
  );

  const removeProfileImageFromCache = useCallback(async uuid => {
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
  }, []);

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

      const validContacts = refreshArray.filter(element => !element.isLNURL);

      const results = await Promise.allSettled(
        validContacts.map(element => refreshCache(element.uuid, null, true)),
      );

      const cacheUpdates = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          try {
            const uuid = validContacts[index].uuid;
            const newEntry = result.value;
            const existingEntry = cachedImagesRef.current[uuid];

            // Only add to updates if the entry is new or has changed
            if (
              !existingEntry ||
              existingEntry.updated !== newEntry.updated ||
              existingEntry.localUri !== newEntry.localUri
            ) {
              cacheUpdates[uuid] = newEntry;
            }
          } catch (err) {
            console.error('Error updating response', err);
          }
        }
      });

      if (Object.keys(cacheUpdates).length > 0) {
        setCache(prev => ({ ...prev, ...cacheUpdates }));
      }
    }
    setTimeout(() => {
      refreshContactsImages();
    }, 5000); //delay to allow homepage to settle
  }, [
    decodedAddedContacts,
    didGetToHomepage,
    masterInfoObject?.uuid,
    sparkInformation.identityPubKey,
    refreshCache,
  ]);

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
