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
  readDirectoryAsync,
} from 'expo-file-system/legacy';
import {
  getAllLocalKeys,
  getMultipleItems,
} from '../app/functions/localStorage';
const FILE_DIR = cacheDirectory + 'profile_images/';
// The on-disk path is fully derived from the uuid + the CURRENT cache
// directory. iOS changes the app's container path on every version update, so
// any absolute path we persisted earlier is stale even though the file itself
// survives — always reconstruct it here instead of trusting a stored value.
const fileUriForUuid = uuid => `${FILE_DIR}${uuid}.jpg`;
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
  // Per-uuid timestamp of the last successful automatic freshness check. Bounds
  // cost: profile images change rarely, so once an image is verified current we
  // don't hit getMetadata again for this uuid for a full day, even across app
  // relaunches (the timestamp is persisted inside the cache entry itself).
  const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;

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
          try {
            initialCache[uuid] = JSON.parse(value);
          } catch (err) {
            // A crash mid-write can leave a truncated/corrupt pointer. Skip just
            // that entry instead of aborting the whole reconcile (which would
            // also drop every healthy entry).
            console.log('Dropping corrupt image cache entry', uuid);
          }
        }
      });

      // Reconcile pointers against the actual files. The OS can purge the
      // cache directory while the AsyncStorage pointer survives, leaving a
      // localUri whose file no longer exists. Drop those entries so the UI
      // falls back to the identicon and the freshness pass re-downloads them,
      // rather than trying to load a dead path forever. Entries with a null
      // localUri (an intentionally deleted image) are kept as-is. Done with a
      // single directory listing rather than one getInfoAsync per entry, so a
      // large contact list doesn't issue N stat calls on every launch. The
      // listing reflects the current cache dir, so a moved storage location
      // (post app-update) rehydrates correctly.
      const existingFiles = new Set();
      try {
        (await readDirectoryAsync(FILE_DIR)).forEach(file =>
          existingFiles.add(file),
        );
      } catch (err) {
        // Directory doesn't exist yet (no images downloaded) — an empty set
        // drops pointers to files that can't exist, matching the old per-file
        // `exists: false` path.
      }
      const entries = Object.entries(initialCache);
      const validatedCache = {};
      entries.forEach(([uuid, entry]) => {
        if (!entry?.localUri) {
          validatedCache[uuid] = entry;
          return;
        }
        const localUri = fileUriForUuid(uuid);
        if (existingFiles.has(`${uuid}.jpg`)) {
          validatedCache[uuid] = { ...entry, uri: localUri, localUri };
        } else {
          console.log('Dropping stale image pointer (file missing)', uuid);
        }
      });

      setCache(validatedCache);
    } catch (e) {
      console.error('Error loading image cache from storage', e);
    }
  }, []);

  // Only reload the cache when the actual SET of contacts changes (a contact was
  // added or removed). Metadata-only edits (name, bio, pin/favorite) re-encrypt
  // addedContacts → new decodedAddedContacts reference, but they don't introduce
  // any new image uuid, so reloading the whole cache for them is wasted work.
  const previousContactUuidsRef = useRef(null);
  useEffect(() => {
    const uuids = [...decodedAddedContacts]
      .map(c => c?.uuid)
      .sort()
      .join(',');
    if (uuids === previousContactUuidsRef.current) {
      return;
    }
    previousContactUuidsRef.current = uuids;
    refreshCacheObject();
  }, [decodedAddedContacts, refreshCacheObject]);

  const refreshCache = useCallback(
    async (uuid, hasDownloadURL, skipCacheUpdate = false) => {
      if (inFlightRequests.current.has(uuid)) {
        return inFlightRequests.current.get(uuid);
      }

      // Automatic refreshes (hasDownloadURL falsy) are bounded by a success TTL:
      // once an image was verified current, don't re-hit getMetadata for it
      // within the window. User-driven calls always run.
      if (!hasDownloadURL) {
        const cached = cacheRef.current[uuid];
        if (
          cached?.lastChecked &&
          Date.now() - cached.lastChecked < SUCCESS_TTL_MS
        ) {
          console.log(
            'Image still fresh (within success TTL), skipping refresh for',
            uuid,
          );
          return cached;
        }
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
              const currentUri = fileUriForUuid(uuid);
              const fileInfo = await getInfoAsync(currentUri);
              if (fileInfo.exists) {
                autoHealCooldownRef.current.delete(uuid);
                const freshEntry = {
                  ...cached,
                  uri: currentUri,
                  localUri: currentUri,
                  lastChecked: Date.now(),
                };
                await setLocalStorageItem(key, JSON.stringify(freshEntry));
                if (!skipCacheUpdate) {
                  setCache(prev => ({ ...prev, [uuid]: freshEntry }));
                }
                return freshEntry;
              }
            }

            url = await getDownloadURL(reference);
          } else {
            url = hasDownloadURL;
            updated = new Date().toISOString();
          }

          const localUri = fileUriForUuid(uuid);

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

          const newEntry = hasDownloadURL
            ? { uri: localUri, localUri, updated }
            : { uri: localUri, localUri, updated, lastChecked: Date.now() };

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
  const staggerTimerRef = useRef(null);

  const runFreshnessPass = useCallback(() => {
    if (!masterInfoObject?.uuid) return;
    const now = Date.now();
    if (now - lastFreshnessPassRef.current < 30 * 1000) return;
    lastFreshnessPassRef.current = now;
    // Supersede any stagger chain still pending from a prior pass.
    if (staggerTimerRef.current) clearTimeout(staggerTimerRef.current);

    // Always check every image; refreshCache returns the cached copy when it's
    // already current (and skips entirely within the success TTL), so this only
    // downloads what's stale or missing. This is intentionally independent of
    // the Spark wallet — profile images don't need it, and gating on it stranded
    // images on degraded-wallet devices. Contacts are processed in small batches
    // so a large contact list doesn't fire a wall of metadata calls at once.
    const validContacts = [
      ...decodedAddedContacts.filter(c => !c.isLNURL),
      { uuid: masterInfoObject.uuid },
    ];
    console.log('valid contacts', validContacts);

    const STAGGER_BATCH_SIZE = 5;
    const STAGGER_DELAY_MS = 5000;
    let index = 0;
    const processBatch = () => {
      const batch = validContacts.slice(index, index + STAGGER_BATCH_SIZE);
      index += STAGGER_BATCH_SIZE;
      batch.forEach(contact => {
        refreshCache(contact.uuid, null, false) // skipCacheUpdate = false → streams in
          .catch(err => {
            console.log(`Image refresh failed for ${contact.uuid}`, err);
          });
      });
      if (index < validContacts.length) {
        staggerTimerRef.current = setTimeout(processBatch, STAGGER_DELAY_MS);
      }
    };
    processBatch();
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

  // Cancel any pending stagger chain on unmount so it can't fire setCache on a
  // torn-down provider.
  useEffect(() => {
    return () => {
      if (staggerTimerRef.current) clearTimeout(staggerTimerRef.current);
    };
  }, []);

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
