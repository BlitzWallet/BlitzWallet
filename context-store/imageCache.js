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
const FILE_DIR = cacheDirectory + 'profile_images/';
const ImageCacheContext = createContext();

export function ImageCacheProvider({ children }) {
  const [cache, setCache] = useState({});
  const { didGetToHomepage, appState } = useAppStatus();
  const { decodedAddedContacts } = useGlobalContactsInfo();
  const { masterInfoObject } = useGlobalContextProvider();
  const didRunContextCacheCheck = useRef(false);
  const cacheRef = useRef(cache);

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  const inFlightRequests = useRef(new Map());
  // Per-uuid timestamp of the last automatic (non user-driven) download attempt.
  // Bounds cost: an image that can never load won't be re-fetched more than once
  // per cooldown window, even across component remounts / navigation storms.
  const autoHealCooldownRef = useRef(new Map());
  const AUTO_HEAL_COOLDOWN_MS = 60 * 1000;

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

      // Reconcile pointers against the actual files. The OS can purge the
      // cache directory while the AsyncStorage pointer survives, leaving a
      // localUri whose file no longer exists. Drop those entries so the UI
      // falls back to the identicon and the freshness pass re-downloads them,
      // rather than trying to load a dead path forever. Entries with a null
      // localUri (an intentionally deleted image) are kept as-is. Processed in
      // small batches so a large contact list doesn't block the JS thread.
      const entries = Object.entries(initialCache);
      const validatedCache = {};
      const BATCH_SIZE = 10;
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async ([uuid, entry]) => {
            if (!entry?.localUri) {
              validatedCache[uuid] = entry;
              return;
            }
            try {
              const fileInfo = await getInfoAsync(entry.localUri);
              if (fileInfo.exists) {
                validatedCache[uuid] = entry;
              } else {
                console.log(
                  'Dropping stale image pointer (file missing)',
                  uuid,
                );
              }
            } catch (err) {
              // If we can't stat the file, keep the pointer rather than lose it.
              validatedCache[uuid] = entry;
            }
          }),
        );
      }

      setCache(validatedCache);
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

      // Automatic heals (hasDownloadURL falsy) are rate-limited per uuid, but
      // only after a *failed* attempt — a permanently-broken image (deleted
      // server-side, 404) can't drive repeated downloads across remounts, while
      // a transient purge that re-downloads successfully still heals right away.
      // Explicit user-driven calls (upload/save) always run.
      if (!hasDownloadURL) {
        const lastFailedAttempt = autoHealCooldownRef.current.get(uuid);
        if (
          lastFailedAttempt &&
          Date.now() - lastFailedAttempt < AUTO_HEAL_COOLDOWN_MS
        ) {
          console.log(
            'Auto-heal cooldown active (recent failure), skipping refresh for',
            uuid,
          );
          return cacheRef.current[uuid];
        }
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
              if (fileInfo.exists) {
                autoHealCooldownRef.current.delete(uuid);
                return cached;
              }
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
            const downloadResult = await downloadAsync(url, localUri);
            if (!downloadResult || downloadResult.status !== 200) {
              throw new Error(
                `Image download failed with status ${downloadResult?.status}`,
              );
            }
          } else {
            console.log('Copying image from', url, 'to', localUri);
            await copyAsync({ from: url, to: localUri });
          }

          // Never persist a pointer to a partial/empty file — a bad write here
          // would look like a valid cache entry but fail to render.
          const writtenInfo = await getInfoAsync(localUri);
          if (!writtenInfo.exists || !writtenInfo.size) {
            throw new Error('Saved image is missing or empty');
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

          // Successful download — clear any prior failure cooldown.
          autoHealCooldownRef.current.delete(uuid);
          return newEntry;
        } catch (err) {
          console.log('Error refreshing image cache', err);
          // Arm the cooldown only for automatic heals so a failing image isn't
          // re-fetched on every remount. User-driven calls are never throttled.
          if (!hasDownloadURL) {
            autoHealCooldownRef.current.set(uuid, Date.now());
          }
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
        updated: new Date().toISOString(),
      };

      await setLocalStorageItem(key, JSON.stringify(newEntry));
      setCache(prev => ({ ...prev, [uuid]: newEntry }));
      return newEntry;
    } catch (err) {
      console.log('Error removing profile image', err);
    }
  }, []);

  const lastFreshnessPassRef = useRef(0);

  const runFreshnessPass = useCallback(() => {
    if (!masterInfoObject?.uuid) return;
    const now = Date.now();
    if (now - lastFreshnessPassRef.current < 30 * 1000) return;
    lastFreshnessPassRef.current = now;

    // Always check every image; refreshCache returns the cached copy when it's
    // already current, so this only downloads what's stale or missing. This is
    // intentionally independent of the Spark wallet — profile images don't need
    // it, and gating on it stranded images on degraded-wallet devices.
    const validContacts = [
      ...decodedAddedContacts.filter(c => !c.isLNURL),
      { uuid: masterInfoObject.uuid },
    ];
    console.log('valid contacts', validContacts);

    validContacts.forEach(contact => {
      refreshCache(contact.uuid, null, false) // skipCacheUpdate = false → streams in
        .catch(err => {
          console.log(`Image refresh failed for ${contact.uuid}`, err);
        });
    });
  }, [decodedAddedContacts, masterInfoObject?.uuid, refreshCache]);

  // Initial pass shortly after reaching the homepage.
  useEffect(() => {
    if (!didGetToHomepage) return;
    if (didRunContextCacheCheck.current) return;
    if (!masterInfoObject?.uuid) return;
    didRunContextCacheCheck.current = true;
    const timer = setTimeout(() => {
      runFreshnessPass();
    }, 5000); //delay to allow homepage to settle
    return () => clearTimeout(timer);
  }, [didGetToHomepage, masterInfoObject?.uuid, runFreshnessPass]);

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
