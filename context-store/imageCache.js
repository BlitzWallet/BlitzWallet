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
import { useGlobalContactsInfo } from './globalContacts';
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
  const { decodedAddedContacts } = useGlobalContactsInfo();
  const { masterInfoObject } = useGlobalContextProvider();
  const didRunContextCacheCheck = useRef(false);
  const cacheRef = useRef(cache);

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

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
    refreshCacheObject();
  }, [decodedAddedContacts, refreshCacheObject]); //rerun the cache when adding or removing contacts

  const refreshCache = useCallback(
    async (uuid, hasDownloadURL, skipCacheUpdate = false) => {
      if (inFlightRequests.current.has(uuid)) {
        return inFlightRequests.current.get(uuid);
      }
      const requestPromise = (async () => {
        try {
          console.log('Refreshing image for', uuid);
          const key = `${BLITZ_PROFILE_IMG_STORAGE_REF}/${uuid}`;
          let url;
          let metadata;
          let updated;

          if (!hasDownloadURL) {
            const reference = ref(
              storage,
              `${BLITZ_PROFILE_IMG_STORAGE_REF}/${uuid}.jpg`,
            );
            const metadata = await getMetadata(reference);
            updated = metadata.updated;

            const cached = cacheRef.current[uuid];
            if (cached && cached.updated === updated) {
              const fileInfo = await getInfoAsync(cached.localUri);
              if (fileInfo.exists) return cached;
            }

            url = await getDownloadURL(reference);
          } else {
            url = hasDownloadURL;
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

          const newEntry = {
            uri: localUri,
            localUri,
            updated,
          };

          await setLocalStorageItem(key, JSON.stringify(newEntry));

          if (!skipCacheUpdate) {
            setCache(prev => ({ ...prev, [uuid]: newEntry }));
          }

          return newEntry;
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
    [],
  );

  const removeProfileImageFromCache = useCallback(async uuid => {
    try {
      console.log('Deleting profile image', uuid);
      const key = `${BLITZ_PROFILE_IMG_STORAGE_REF}/${uuid}`;

      const newEntry = {
        uri: null,
        localUri: null,
        updated: new Date().getTime(),
      };

      await setLocalStorageItem(key, JSON.stringify(newEntry));
      setCache(prev => ({ ...prev, [uuid]: newEntry }));
      return newEntry;
    } catch (err) {
      console.log('Error removing profile image', err);
    }
  }, []);

  useEffect(() => {
    if (!didGetToHomepage) return;
    if (didRunContextCacheCheck.current) return;
    if (!masterInfoObject.uuid) return;
    if (!sparkInformation.identityPubKey) return;
    didRunContextCacheCheck.current = true;
    function refreshContactsImages() {
      // allways check all images, will return cahced image if its already cached. But this prevents against stale images
      const validContacts = [
        ...decodedAddedContacts.filter(c => !c.isLNURL),
        { uuid: masterInfoObject.uuid },
      ];

      validContacts.forEach(contact => {
        refreshCache(contact.uuid, null, false) // skipCacheUpdate = false → streams in
          .catch(err => {
            console.log(`Image refresh failed for ${contact.uuid}`, err);
          });
      });
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
