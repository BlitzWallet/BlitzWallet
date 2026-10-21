import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  InteractionManager,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useBTCMap } from '../../../context-store/btcMapContext';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import GetThemeColors from '../../hooks/themeColors';
import { FONT, ICONS, SIZES } from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useAppStatus } from '../../../context-store/appStatus';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { COLORS, SHADOWS } from '../../constants/theme';
import ThemeImage from '../../functions/CustomElements/themeImage';
import { cameraToBbox } from '../../functions/btcMap/mapClustering';
import { resolvePlaceCategory } from '../../functions/btcMap/iconCategory';
import {
  clearBTCMapClusterCache,
  getOrBuildBTCMapClusterManager,
} from '../../functions/btcMap/btcMapClusterCache';
import { useTranslation } from 'react-i18next';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import IconButton from '../../functions/CustomElements/redesign/IconButton';

const DEFAULT_ZOOM = 13;
const DISABLED_MAP_PROPS = {
  rotateEnabled: false,
  pitchEnabled: false,
  showsCompass: false,
  showsMyLocationButton: false,
  showsPointsOfInterest: false,
  showsTraffic: false,
  showsIndoors: false,
  toolbarEnabled: false,
};

export default function BTCMapScreen() {
  const navigate = useNavigation();
  const { screenDimensions } = useAppStatus();
  const { tokens } = GetThemeColors();
  const { theme } = useGlobalThemeContext();
  const { topPadding, bottomPadding } = useGlobalInsets();
  const {
    isLoading: storeLoading,
    dataVersion,
    syncPlaces,
    getPlacesInViewport,
    userLocation,
    DEFAULT_LOCATION,
    requestAndFetchLocation,
    refreshLocation,
  } = useBTCMap();
  const { t } = useTranslation();

  const [isMapReady, setIsMapReady] = useState(false);
  const [isClusteringReady, setIsClusteringReady] = useState(false);
  const [markers, setMarkers] = useState([]);
  const [placeCount, setPlaceCount] = useState(0);
  const [filter, setFilter] = useState({
    categories: [],
    distanceUnit: 'auto',
  });

  const loading = storeLoading || !isClusteringReady;
  const isFilterActive =
    filter.categories.length > 0 || filter.distanceUnit !== 'auto';
  // Design sits the count pill 6 below the safe area (40 total on iPhone)
  // and the control stack 78 above that (118 total).
  const pillBottom = bottomPadding + 6;
  const fabBottom = pillBottom + 78;

  const SCREEN_ASPECT_RATIO = screenDimensions.width / screenDimensions.height;
  const activeLocation = userLocation ?? DEFAULT_LOCATION;

  // Camera as ref — no rerenders during pan
  const mapRef = useRef(null);
  const cameraRef = useRef({
    lat: activeLocation.latitude,
    lon: activeLocation.longitude,
    zoom: DEFAULT_ZOOM,
  });

  // Debounce and dedup refs
  const markerTimerRef = useRef(null);
  const markerTaskRef = useRef(null);
  const lastQueryRef = useRef(null);
  const lastRenderedMarkersRef = useRef([]);
  const lastRenderedCountRef = useRef(0);

  // Cluster manager and markers data refs (read by event handlers without stale closures)
  const clusterManagerRef = useRef(null);
  const markersDataRef = useRef([]);

  // Stale-query guard — incremented on each new async viewport query
  const queryIdRef = useRef(0);

  // --- Marker update (called after cluster build and on camera change) ---
  const updateMarkersForCamera = useCallback(
    (lat, lon, z) => {
      const manager = clusterManagerRef.current;
      if (!manager || !manager.isLoaded()) {
        setMarkers([]);
        setPlaceCount(0);

        lastRenderedMarkersRef.current = [];
        lastRenderedCountRef.current = 0;
        return;
      }

      const padding = z >= 14 ? 0.25 : z >= 10 ? 0.5 : 0.75;
      const bbox = cameraToBbox(lat, lon, z, SCREEN_ASPECT_RATIO, padding);
      const clustered = manager.getClusters(bbox, z);
      markersDataRef.current = clustered;

      let count = 0;
      for (const m of clustered) count += m.count;
      setPlaceCount(count);

      // Deep-equality deduplication — avoid unnecessary setMarkers calls
      const prev = lastRenderedMarkersRef.current;
      let same =
        prev.length === clustered.length &&
        lastRenderedCountRef.current === count;
      if (same) {
        for (let i = 0; i < clustered.length; i++) {
          const a = prev[i];
          const b = clustered[i];
          if (
            a.id !== b.id ||
            a.latitude !== b.latitude ||
            a.longitude !== b.longitude
          ) {
            same = false;
            break;
          }
        }
      }
      if (same) return;

      lastRenderedMarkersRef.current = clustered;
      lastRenderedCountRef.current = count;
      setMarkers(clustered);
    },
    [SCREEN_ASPECT_RATIO],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (markerTimerRef.current) clearTimeout(markerTimerRef.current);
      if (markerTaskRef.current) markerTaskRef.current.cancel();
    };
  }, []);

  // Request location then show map — location fetch happens in the 50ms nav-transition window
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const coords = await requestAndFetchLocation();
        if (coords) {
          cameraRef.current = {
            lat: coords.latitude,
            lon: coords.longitude,
            zoom: DEFAULT_ZOOM,
          };
        }
      } catch (_) {}
      if (!cancelled) setIsMapReady(true);
    };
    const timer = setTimeout(init, 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Query SQLite for viewport points, build cluster index, update markers
  const buildClustersForViewport = useCallback(async () => {
    if (!isMapReady) return;

    const { lat, lon, zoom } = cameraRef.current;
    const z = Math.max(0, Math.floor(zoom));
    const padding = z >= 14 ? 0.25 : z >= 10 ? 0.5 : 0.75;
    const bbox = cameraToBbox(lat, lon, z, SCREEN_ASPECT_RATIO, padding);
    const [minLon, minLat, maxLon, maxLat] = bbox;

    const thisQueryId = ++queryIdRef.current;

    let points;
    try {
      points = await getPlacesInViewport(minLat, maxLat, minLon, maxLon);
    } catch (_) {
      return;
    }
    if (queryIdRef.current !== thisQueryId) return;

    if (filter.categories.length) {
      const categorySet = new Set(filter.categories);
      points = points.filter(p => categorySet.has(resolvePlaceCategory(p)));
    }

    if (!points.length) {
      clusterManagerRef.current = null;
      setMarkers([]);
      setPlaceCount(0);
      setIsClusteringReady(true);
      return;
    }

    const cacheGranularity = z >= 14 ? 20 : z >= 10 ? 10 : 5;
    const manager = getOrBuildBTCMapClusterManager(
      `btcmap:v${dataVersion}:${z}:${
        Math.round(lat * cacheGranularity) / cacheGranularity
      }:${Math.round(lon * cacheGranularity) / cacheGranularity}`,
      points,
      { radius: 50, maxZoom: 17, minPoints: 2 },
    );

    if (queryIdRef.current !== thisQueryId) return;

    clusterManagerRef.current = manager;
    updateMarkersForCamera(lat, lon, zoom);
    setIsClusteringReady(true);
  }, [
    isMapReady,
    getPlacesInViewport,
    updateMarkersForCamera,
    SCREEN_ASPECT_RATIO,
    filter.categories,
    dataVersion,
  ]);

  // Trigger initial cluster build when map becomes ready
  useEffect(() => {
    if (!isMapReady) return;
    buildClustersForViewport();
  }, [isMapReady, buildClustersForViewport]);

  // Re-query viewport when a sync writes new data
  useEffect(() => {
    if (!isMapReady || dataVersion === 0) return;
    buildClustersForViewport();
  }, [dataVersion, isMapReady, buildClustersForViewport]);

  // Debounced camera change handler — skips tiny movements within the same zoom bucket
  const handleCameraChange = useCallback(
    region => {
      if (!region) return;
      const newLat = region.latitude;
      const newLon = region.longitude;
      const newZoom = Math.round(
        Math.log(360 / region.latitudeDelta) / Math.LN2,
      );
      if (
        !Number.isFinite(newZoom) ||
        !Number.isFinite(newLat) ||
        !Number.isFinite(newLon)
      )
        return;
      cameraRef.current = { lat: newLat, lon: newLon, zoom: newZoom };

      const zoomFloor = Math.floor(newZoom);
      const last = lastQueryRef.current;
      const span = 360 / Math.pow(2, Math.max(newZoom, 0));
      const shouldSkip =
        last &&
        last.zoomFloor === zoomFloor &&
        Math.abs(newLat - last.lat) < span * 0.12 &&
        Math.abs(newLon - last.lon) < span * SCREEN_ASPECT_RATIO * 0.12;

      if (shouldSkip) return;

      if (markerTimerRef.current) clearTimeout(markerTimerRef.current);
      markerTimerRef.current = setTimeout(() => {
        lastQueryRef.current = { lat: newLat, lon: newLon, zoomFloor };
        if (markerTaskRef.current) markerTaskRef.current.cancel();
        markerTaskRef.current = InteractionManager.runAfterInteractions(() => {
          buildClustersForViewport();
        });
      }, 250);
    },
    [buildClustersForViewport, SCREEN_ASPECT_RATIO],
  );

  // Marker press handler
  const handleMarkerPress = useCallback(
    marker => {
      const data = markersDataRef.current.find(m => m.id === marker.id);
      if (!data) return;

      if (data.type === 'cluster' && data.clusterId != null) {
        const manager = clusterManagerRef.current;
        if (!manager) return;
        const expansionZoom = Math.min(
          manager.getClusterExpansionZoom(data.clusterId) + 1,
          18,
        );
        mapRef.current?.animateToRegion(
          {
            latitude: data.latitude,
            longitude: data.longitude,
            latitudeDelta: 360 / Math.pow(2, expansionZoom),
            longitudeDelta: 360 / Math.pow(2, expansionZoom),
          },
          400,
        );
      } else if (data.placeId) {
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'btcMapMerchant',
          placeId: data.placeId,
          source: data.source,
        });
      }
    },
    [navigate],
  );

  const handleMyLocation = useCallback(async () => {
    try {
      const coords = await refreshLocation();
      if (coords) {
        mapRef.current?.animateToRegion({
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        cameraRef.current = {
          lat: coords.latitude,
          lon: coords.longitude,
          zoom: 13,
        };
      }
    } catch (_) {}
  }, []);

  const handleZoomIn = useCallback(() => {
    const { lat, lon, zoom } = cameraRef.current;
    const newZoom = Math.min(zoom + 2, 20);
    const delta = 360 / Math.pow(2, newZoom);
    cameraRef.current = { lat, lon, zoom: newZoom };
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lon,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      250,
    );
  }, []);

  const handleZoomOut = useCallback(() => {
    const { lat, lon, zoom } = cameraRef.current;
    const newZoom = Math.max(zoom - 2, 1);
    const delta = Math.min(360 / Math.pow(2, newZoom), 60);
    cameraRef.current = { lat, lon, zoom: newZoom };
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lon,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      250,
    );
  }, []);

  const openFilter = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'btcMapFilter',
      currentFilter: filter,
      onSelectFilter: setFilter,
      sliderHight: 0.6,
    });
  }, [navigate, filter]);

  const openList = useCallback(() => {
    const { lat, lon, zoom } = cameraRef.current;
    const z = Math.max(0, Math.floor(zoom));
    const padding = z >= 14 ? 0.25 : z >= 10 ? 0.5 : 0.75;
    const bbox = cameraToBbox(lat, lon, z, SCREEN_ASPECT_RATIO, padding);
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'btcMapList',
      bbox,
      categories: filter.categories,
      distanceUnit: filter.distanceUnit,
      userLocation,
      placeCount,
      sliderHight: 0.85,
    });
  }, [navigate, filter, userLocation, SCREEN_ASPECT_RATIO, placeCount]);

  useEffect(() => {
    // Sync on visit — the only place merchant data is pulled from the
    // network. Deferred so the navigation transition isn't blocked; throttled
    // to once per 4h inside syncPlaces.
    const task = InteractionManager.runAfterInteractions(() => {
      syncPlaces();
    });

    return () => {
      task.cancel();
      // cleer cache to remove from ram
      clearBTCMapClusterCache();
    };
  }, [syncPlaces]);

  return (
    <GlobalThemeView
      styles={{
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <View style={styles.container}>
        {/* Skeleton shown until map is ready */}
        {!isMapReady && (
          <FullLoadingScreen text={t('screens.btcMap.map.loadingMap')} />
        )}

        {isMapReady && (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: cameraRef.current.lat,
              longitude: cameraRef.current.lon,
              latitudeDelta: 360 / Math.pow(2, cameraRef.current.zoom),
              longitudeDelta: 360 / Math.pow(2, cameraRef.current.zoom),
            }}
            onRegionChangeComplete={handleCameraChange}
            userInterfaceStyle={theme ? 'dark' : 'light'}
            showsUserLocation
            {...DISABLED_MAP_PROPS}
          >
            {markers.slice(0, 200).map(m => {
              if (m.type === 'cluster') {
                const size = m.count < 10 ? 44 : m.count < 100 ? 50 : 60;
                return (
                  <Marker
                    key={m.id}
                    coordinate={{
                      latitude: m.latitude,
                      longitude: m.longitude,
                    }}
                    accessibilityLabel={t('screens.btcMap.map.placesHere', {
                      count: m.count,
                    })}
                    onPress={() => handleMarkerPress(m)}
                  >
                    <View
                      style={[
                        styles.clusterMarker,
                        {
                          width: size,
                          height: size,
                          borderRadius: size / 2,
                          backgroundColor: tokens.surface,
                        },
                      ]}
                    >
                      <ThemeText
                        content={String(m.count)}
                        styles={[styles.clusterText, { color: tokens.ink }]}
                      />
                    </View>
                  </Marker>
                );
              }
              return (
                <Marker
                  key={m.id}
                  coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                  accessibilityLabel={t('screens.btcMap.map.a11y.place')}
                  onPress={() => handleMarkerPress(m)}
                >
                  <View style={styles.marker}>
                    <ThemeImage
                      styles={{ width: 18, height: 18 }}
                      lightModeIcon={ICONS.bitcoinIcon}
                      darkModeIcon={ICONS.bitcoinIcon}
                      lightsOutIcon={ICONS.bitcoinIcon}
                    />
                  </View>
                </Marker>
              );
            })}
          </MapView>
        )}

        {isMapReady && loading && (
          <View
            style={[
              styles.countPill,
              { bottom: pillBottom, backgroundColor: tokens.surface },
            ]}
          >
            <ActivityIndicator size="small" color={tokens.accent} />
            <ThemeText
              content={t('screens.btcMap.map.loadingMerchants')}
              styles={styles.countText}
            />
          </View>
        )}

        <View style={[styles.fabStack, { bottom: fabBottom }]}>
          <IconButton
            icon="LocateFixed"
            label="screens.btcMap.map.a11y.myLocation"
            tone="floating"
            onPress={handleMyLocation}
            size={44}
            iconSize={20}
            activeOpacity={0.8}
          />
          <IconButton
            icon="Plus"
            label="screens.btcMap.map.a11y.zoomIn"
            tone="floating"
            onPress={handleZoomIn}
            size={44}
            iconSize={20}
            activeOpacity={0.8}
          />
          <IconButton
            icon="Minus"
            label="screens.btcMap.map.a11y.zoomOut"
            tone="floating"
            onPress={handleZoomOut}
            size={44}
            iconSize={20}
            activeOpacity={0.8}
          />
        </View>

        {/* Floating pill navbar */}
        <View style={[styles.navbar, { top: topPadding }]}>
          <IconButton
            icon="ArrowLeft"
            label="constants.back"
            tone="floating"
            onPress={navigate.goBack}
            size={44}
            iconSize={20}
            activeOpacity={0.8}
          />

          <View
            style={[styles.navTitlePill, { backgroundColor: tokens.surface }]}
          >
            <ThemeText
              styles={styles.navTitle}
              content={t('screens.btcMap.map.title')}
            />
          </View>

          <IconButton
            icon="SlidersHorizontal"
            label={
              isFilterActive
                ? 'screens.btcMap.map.a11y.filterOn'
                : 'screens.btcMap.map.a11y.filter'
            }
            tone="floating"
            onPress={openFilter}
            size={44}
            iconSize={20}
            showActiveDot={isFilterActive}
            activeOpacity={0.8}
          />
        </View>

        {/* Bottom place-count pill — opens the list view */}
        {isMapReady && !loading && placeCount > 0 && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openList}
            style={[
              styles.countPill,
              { bottom: pillBottom, backgroundColor: tokens.surface },
            ]}
          >
            <ThemeIcon redesign size={18} iconName="List" />
            <ThemeText
              styles={styles.countText}
              content={t('screens.btcMap.map.placesHere', {
                count: placeCount,
              })}
            />
          </TouchableOpacity>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  navTitlePill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 20,
    justifyContent: 'center',
    ...SHADOWS.ring,
  },
  navTitle: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.medium,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  countPill: {
    minHeight: 48,
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: 999,
    ...SHADOWS.ring,
  },
  countText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  fabStack: { position: 'absolute', right: 16, gap: 10 },
  marker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: COLORS.bitcoinOrange,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.pin,
  },
  clusterMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.ring,
  },
  clusterText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
});
