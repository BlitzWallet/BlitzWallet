import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  getAllPlacesInBbox,
  getProviderPlace,
  replaceProviderPlaces,
  getLastModified,
  setLastModified,
  getLastSyncTime,
  setLastSyncTime,
  getProviderLastSyncTime,
  setProviderLastSyncTime,
  upsertPlaces,
  deletePlaces,
  truncateAndInsertPlaces,
  needsToResyncMapsData,
  markNameBackfillDone,
} from '../app/functions/btcMap/btcMapStorage';
import { dedupeMerge } from '../app/functions/btcMap/mergePlaces';
import { clearBTCMapClusterCache } from '../app/functions/btcMap/btcMapClusterCache';
import { blitzProxyFetch } from '../app/functions/blitzProxyFetch';
import * as Location from 'expo-location';

// Merchant map data is served by the VPS proxy, not the getBTCMapData Cloud
// Function: the proxy stays warm, so it caches the multi-MB snapshot in memory
// and returns it gzipped (the old ECDH-encrypted callable could do neither).
// Public data — no encryption envelope. All calls go through blitzProxyFetch
// so the Bearer token + base URL live in one place (this constant used to be
// duplicated here to avoid the firestore module graph; blitzProxyFetch pulls
// only @react-native-firebase/auth).
const DEFAULT_LOCATION = { latitude: 51.5074, longitude: -0.1278 };
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PARSE_BATCH = 500;

const BTCMapContext = createContext(null);

// Parse a provider's NDJSON snapshot and write it to SQLite in small batches,
// yielding to the event loop between batches so a large snapshot (MoneyBadger
// ~5.5k) never blocks the JS thread in one synchronous JSON.parse.
async function ingestProviderNDJSON(source, ndjson) {
  if (!ndjson) {
    await replaceProviderPlaces(source, [], { clear: true });
    return;
  }
  const lines = ndjson.split('\n');
  let clear = true;
  for (let i = 0; i < lines.length; i += PARSE_BATCH) {
    const batch = [];
    const end = Math.min(i + PARSE_BATCH, lines.length);
    for (let j = i; j < end; j++) {
      const line = lines[j];
      if (!line) continue;
      try {
        batch.push(JSON.parse(line));
      } catch (_) {}
    }
    await replaceProviderPlaces(source, batch, { clear });
    clear = false;
    await new Promise(res => setTimeout(res, 0));
  }
}

export function BTCMapProvider({ children }) {
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [userLocation, setUserLocation] = useState(null);

  // Sync from the proxy — full on first launch, incremental afterward
  const syncPlaces = useCallback(async () => {
    const [lastSyncTime, needsToResync] = await Promise.all([
      getLastSyncTime(),
      needsToResyncMapsData(),
    ]);
    if (
      lastSyncTime &&
      Date.now() - lastSyncTime < FOUR_HOURS_MS &&
      !needsToResync
    )
      return;
    setIsLoading(true);
    setSyncError(null);
    try {
      // Aux providers change slowly — only pull them once a week. The client
      // tells the backend whether to include them so an off-week sync doesn't
      // fetch/encrypt/transfer the provider payload at all.
      const providerLastSync = await getProviderLastSyncTime();
      const includeProviders =
        !providerLastSync || Date.now() - providerLastSync > ONE_WEEK_MS;

      const currentTs = await getLastModified();
      const params = new URLSearchParams();
      if (currentTs && !needsToResync) params.set('updated_since', currentTs);
      if (includeProviders) params.set('providers', '1');
      // The server decides full-vs-delta purely from `updated_since`, so the
      // client already knows which shape comes back — no need to parse for it.
      const isFullSync = !params.has('updated_since');

      const response = await blitzProxyFetch(
        `/btcmap/sync?${params.toString()}`,
      );
      if (!response.ok) throw new Error(`Sync failed — ${response.status}`);

      // The body is handed to SQLite as one string and parsed in C — see
      // btcMapSql.js. Nothing here calls JSON.parse on a multi-MB payload.
      const result = await response.json();
      if (isFullSync) {
        clearBTCMapClusterCache();
        await truncateAndInsertPlaces(result.places);
        // Full sync rewrote every row with server names — the old
        // delta-dropped-name bug can no longer affect this install.
        await markNameBackfillDone();
      } else {
        if (result.deleted_ids?.length) await deletePlaces(result.deleted_ids);
        if (result.upserts?.length) await upsertPlaces(result.upserts);
      }

      // Aux providers (Bitcoin Jungle, MoneyBadger) — full snapshots streamed
      // into SQLite in batches (see ingestProviderNDJSON). Only present when the
      // weekly cadence was due; stamp the timestamp so the next 6 days skip them.
      if (includeProviders && result.providers?.length) {
        clearBTCMapClusterCache();
        for (const provider of result.providers) {
          await ingestProviderNDJSON(provider.source, provider.ndjson);
        }
        await setProviderLastSyncTime(Date.now());
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

  // Fetch single place detail on demand (for merchant bottom sheet).
  // BTC Map has no detail stored locally → fetch from the proxy. Aux providers
  // (bitcoinjungle/moneybadger) store all detail fields in SQLite → read local.
  const getPlaceDetail = useCallback(async (placeId, source) => {
    try {
      if (source && source !== 'btcmap') {
        const row = await getProviderPlace(source, placeId);
        if (!row) return null;
        return {
          id: row.native_id,
          source: row.source,
          name: row.name,
          address: row.address,
          lat: row.lat,
          lon: row.lon,
          icon: row.icon,
          phone: row.phone,
          website: row.website,
          email: row.email,
          lightning_address: row.lightning_address,
        };
      }
      const response = await blitzProxyFetch(
        `/btcmap/place/${encodeURIComponent(placeId)}`,
      );
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.log('[BTCMap] detail fetch error:', err);
      return null;
    }
  }, []);

  const getPlacesInViewport = useCallback(
    async (minLat, maxLat, minLon, maxLon) => {
      const rows = await getAllPlacesInBbox(minLat, maxLat, minLon, maxLon);
      return dedupeMerge(rows);
    },
    [],
  );

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
      syncPlaces,
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
      syncPlaces,
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
