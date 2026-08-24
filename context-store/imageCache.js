import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useSyncExternalStore,
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

// Per-uuid entry store backing useImageCacheEntry. Kept separate from the
// context value so list rows can subscribe to a single uuid's entry instead of
// re-rendering whenever ANY image changes. The old whole-cache context caused
// every row of the contacts list to re-render on every setCache during the
// freshness pass — the dominant JS-thread cost of the pass.
function createEntryStore() {
  const entries = new Map();
  const listeners = new Set();
  return {
    get(uuid) {
      return entries.get(uuid);
    },
    set(uuid, entry) {
      entries.set(uuid, entry);
      listeners.forEach(listener => listener());
    },
    setAll(entryMap) {
      entries.clear();
      Object.entries(entryMap).forEach(([uuid, entry]) =>
        entries.set(uuid, entry),
      );
      listeners.forEach(listener => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const ImageCacheStoreContext = createContext(null);
const noopUnsubscribe = () => () => {};

export function ImageCacheProvider({ children }) {
  const [cache, setCache] = useState({});
  const { didGetToHomepage, appState } = useAppStatus();
  const { decodedAddedContacts } = useGlobalContactsInfo();
  const { masterInfoObject } = useGlobalContextProvider();
  const didRunContextCacheCheck = useRef(false);
  const cacheRef = useRef(cache);
  const initialPassTimerRef = useRef(null);
  const runFreshnessPassRef = useRef(null);

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  // Session-scoped success-TTL timestamps (mirrors the persisted lastChecked).
  // Kept outside React state so a freshness re-verification never re-renders
  // consumers; the persisted entry still carries lastChecked for relaunches.
  const lastCheckedRef = useRef(new Map());
  const entryStoreRef = useRef(createEntryStore());

  const commitEntry = useCallback((uuid, entry) => {
    entryStoreRef.current.set(uuid, entry);
    setCache(prev => ({ ...prev, [uuid]: entry }));
  }, []);

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

      Object.entries(validatedCache).forEach(([uuid, entry]) => {
        if (entry?.lastChecked)
          lastCheckedRef.current.set(uuid, entry.lastChecked);
      });
      entryStoreRef.current.setAll(validatedCache);
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
        const lastCheckedAt =
          lastCheckedRef.current.get(uuid) ?? cached?.lastChecked;
        if (lastCheckedAt && Date.now() - lastCheckedAt < SUCCESS_TTL_MS) {
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
                lastCheckedRef.current.set(uuid, freshEntry.lastChecked);
                await setLocalStorageItem(key, JSON.stringify(freshEntry));
                if (!skipCacheUpdate) {
                  // Re-render consumers ONLY when something visible changed
                  // (e.g. a stale path re-anchored after an OS container move).
                  // A pure lastChecked bump must not touch React state —
                  // doing that for every contact on every pass was the
                  // dominant JS-thread cost of the freshness pass.
                  const visibleChanged =
                    freshEntry.uri !== cached.uri ||
                    freshEntry.localUri !== cached.localUri ||
                    freshEntry.updated !== cached.updated;
                  if (visibleChanged) {
                    commitEntry(uuid, freshEntry);
                  }
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
            commitEntry(uuid, newEntry);
          }
          if (newEntry.lastChecked) {
            lastCheckedRef.current.set(uuid, newEntry.lastChecked);
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
    [commitEntry],
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
      commitEntry(uuid, newEntry);
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

  // Initial pass shortly after reaching the homepage. The timer lives in a ref
  // (cancelled only on unmount) because runFreshnessPass's deps churn right
  // after the homepage settles (e.g. the child-account handoff adding the
  // parent contact). An effect-local cleanup would clear the pending pass and
  // the one-shot guard would never reschedule it. The pass is invoked through
  // a ref so the delayed run picks up the latest contact list at fire time.
  useEffect(() => {
    runFreshnessPassRef.current = runFreshnessPass;
  }, [runFreshnessPass]);

  useEffect(() => {
    if (!didGetToHomepage) return;
    if (didRunContextCacheCheck.current) return;
    if (!masterInfoObject?.uuid) return;
    didRunContextCacheCheck.current = true;
    initialPassTimerRef.current = setTimeout(() => {
      runFreshnessPassRef.current();
    }, 5000); //delay to allow homepage to settle
  }, [didGetToHomepage, masterInfoObject?.uuid, runFreshnessPass]);

  // // Re-run the freshness pass when the app returns to the foreground. Only
  // // fires on an actual background→active transition, so the mount-time
  // // appState='active' never triggers an early pass. The 30s pass throttle and
  // // the per-uuid success TTL keep this cheap.
  // const prevAppStateRef = useRef(appState);
  // useEffect(() => {
  //   const prev = prevAppStateRef.current;
  //   prevAppStateRef.current = appState;
  //   if (prev === 'active' || appState !== 'active') return;
  //   if (!didGetToHomepage || !masterInfoObject?.uuid) return;
  //   runFreshnessPass();
  // }, [appState, didGetToHomepage, masterInfoObject?.uuid, runFreshnessPass]);

  // Cancel any pending stagger chain / initial pass on unmount so they can't
  // fire setCache on a torn-down provider.
  useEffect(() => {
    return () => {
      if (staggerTimerRef.current) clearTimeout(staggerTimerRef.current);
      if (initialPassTimerRef.current)
        clearTimeout(initialPassTimerRef.current);
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
    <ImageCacheStoreContext.Provider value={entryStoreRef.current}>
      <ImageCacheContext.Provider value={contextValue}>
        {children}
      </ImageCacheContext.Provider>
    </ImageCacheStoreContext.Provider>
  );
}

export function useImageCache() {
  return useContext(ImageCacheContext);
}

// Subscribe to a single uuid's cache entry. The returned entry only changes
// when THAT uuid's image changes, so rows in contact lists can stay memoized
// while other images update during the freshness pass.
export function useImageCacheEntry(uuid) {
  const store = useContext(ImageCacheStoreContext);
  return useSyncExternalStore(
    store?.subscribe ?? noopUnsubscribe,
    () => store?.get(uuid) ?? undefined,
  );
}
