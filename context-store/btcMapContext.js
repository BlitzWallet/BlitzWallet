import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { InteractionManager } from 'react-native';
import {
  initBTCMapDB,
  getPlacesInBbox,
  getLastModified,
  setLastModified,
  getLastSyncTime,
  setLastSyncTime,
  upsertPlaces,
  deletePlaces,
  truncateAndInsertPlaces,
} from '../app/functions/btcMap/btcMapStorage';
import { clearBTCMapClusterCache } from '../app/functions/btcMap/btcMapClusterCache';
import fetchBackend from '../db/handleBackend';
import { useKeysContext } from './keys';
import * as Location from 'expo-location';

const DEFAULT_LOCATION = { latitude: 51.5074, longitude: -0.1278 };
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

const BTCMapContext = createContext(null);

export function BTCMapProvider({ children }) {
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const { contactsPrivateKey: privateKey, publicKey } = useKeysContext();
  const [userLocation, setUserLocation] = useState(null);

  // Initialize SQLite DB on mount (no data preload — viewport queries on demand)
  const initializeFromCache = useCallback(async () => {
    try {
      await initBTCMapDB();
    } catch (err) {
      console.log('[BTCMap] cache init error:', err);
    }
  }, []);

  // Sync from Firebase — full on first launch, incremental afterward
  const syncPlaces = useCallback(async (privateKey, publicKey) => {
    if (!privateKey || !publicKey) return;
    const lastSyncTime = await getLastSyncTime();
    if (lastSyncTime && Date.now() - lastSyncTime < FOUR_HOURS_MS) return;
    setIsLoading(true);
    setSyncError(null);
    try {
      const currentTs = await getLastModified();
      const requestData = currentTs
        ? { action: 'sync', updated_since: currentTs }
        : { action: 'sync' };

      const result = await fetchBackend(
        'getBTCMapData',
        requestData,
        privateKey,
        publicKey,
      );
      if (!result) throw new Error('Sync failed — no response from Firebase');

      if (result.is_full) {
        clearBTCMapClusterCache();
        await truncateAndInsertPlaces(result.places);
      } else {
        if (result.deleted_ids?.length) await deletePlaces(result.deleted_ids);
        if (result.upserts?.length) await upsertPlaces(result.upserts);
      }

      await setLastModified(result.last_modified);
      await setLastSyncTime(Date.now());
      setDataVersion(v => v + 1);
    } catch (err) {
      console.log('[BTCMap] sync error:', err);
      setSyncError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch single place detail on demand (for merchant bottom sheet)
  const getPlaceDetail = useCallback(async (placeId, privateKey, publicKey) => {
    if (!privateKey || !publicKey) return null;
    try {
      const result = await fetchBackend(
        'getBTCMapData',
        { action: 'detail', placeId },
        privateKey,
        publicKey,
      );
      return result || null;
    } catch (err) {
      console.log('[BTCMap] detail fetch error:', err);
      return null;
    }
  }, []);

  const getPlacesInViewport = useCallback(
    (minLat, maxLat, minLon, maxLon) =>
      getPlacesInBbox(minLat, maxLat, minLon, maxLon),
    [],
  );

  // Initialize from SQLite cache on mount
  useEffect(() => {
    initializeFromCache();
  }, [initializeFromCache]);

  // Sync from network after mount (deferred so navigation transition isn't blocked)
  useEffect(() => {
    if (!privateKey || !publicKey) return;
    const task = InteractionManager.runAfterInteractions(() => {
      syncPlaces(privateKey, publicKey);
    });
    return () => task.cancel();
  }, [syncPlaces, privateKey, publicKey]);

  // load location data
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest,
          });
          if (loc) {
            setUserLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        }
      } catch (_) {}
    })();
  }, []);

  const requestAndFetchLocation = useCallback(async () => {
    try {
      if (userLocation) return null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
      });
      if (!loc) return null;
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserLocation(coords);
      return coords;
    } catch (_) {
      return null;
    }
  }, [userLocation]);

  const refreshLocation = useCallback(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({});
      if (!loc) return null;
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserLocation(coords);
      return coords;
    } catch (_) {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      syncError,
      dataVersion,
      getPlacesInViewport,
      getPlaceDetail,
      userLocation,
      DEFAULT_LOCATION,
      requestAndFetchLocation,
      refreshLocation,
    }),
    [
      isLoading,
      syncError,
      dataVersion,
      getPlacesInViewport,
      getPlaceDetail,
      userLocation,
      DEFAULT_LOCATION,
      requestAndFetchLocation,
      refreshLocation,
    ],
  );

  return (
    <BTCMapContext.Provider value={value}>{children}</BTCMapContext.Provider>
  );
}

export function useBTCMap() {
  const ctx = useContext(BTCMapContext);
  if (!ctx) throw new Error('useBTCMap must be used inside BTCMapProvider');
  return ctx;
}
