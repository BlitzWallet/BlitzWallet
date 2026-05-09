import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  InteractionManager,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useBTCMap } from '../../../context-store/btcMapContext';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import GetThemeColors from '../../hooks/themeColors';
import { CENTER, ICONS, SIZES } from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useAppStatus } from '../../../context-store/appStatus';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { COLORS, SHADOWS, WINDOWWIDTH } from '../../constants/theme';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import ThemeImage from '../../functions/CustomElements/themeImage';
import { cameraToBbox } from '../../functions/btcMap/mapClustering';
import {
  clearBTCMapClusterCache,
  getOrBuildBTCMapClusterManager,
} from '../../functions/btcMap/btcMapClusterCache';
import { useTranslation } from 'react-i18next';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';

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
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();
  const {
    isLoading: storeLoading,
    dataVersion,
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

  const loading = storeLoading || !isClusteringReady;
  const markerBg = theme && darkModeType ? backgroundColor : COLORS.primary;

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

    if (!points.length) {
      clusterManagerRef.current = null;
      setMarkers([]);
      setIsClusteringReady(true);
      return;
    }

    const cacheGranularity = z >= 14 ? 20 : z >= 10 ? 10 : 5;
    const manager = getOrBuildBTCMapClusterManager(
      `btcmap:${z}:${Math.round(lat * cacheGranularity) / cacheGranularity}:${
        Math.round(lon * cacheGranularity) / cacheGranularity
      }`,
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

  useFocusEffect(
    useCallback(() => {
      return () => {
        // cleer cache to remove from ram
        clearBTCMapClusterCache();
      };
    }, []),
  );

  return (
    <GlobalThemeView styles={{ paddingBottom: 0 }}>
      <CustomSettingsTopBar
        containerStyles={{ width: WINDOWWIDTH, ...CENTER }}
        label={t('screens.btcMap.map.title')}
      />

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
                const size = m.count < 10 ? 40 : m.count < 100 ? 50 : 60;
                return (
                  <Marker
                    key={m.id}
                    coordinate={{
                      latitude: m.latitude,
                      longitude: m.longitude,
                    }}
                    onPress={() => handleMarkerPress(m)}
                  >
                    <View
                      style={[
                        styles.clusterMarker,
                        {
                          width: size,
                          height: size,
                          borderRadius: size / 2,
                          backgroundColor: markerBg,
                        },
                      ]}
                    >
                      <ThemeText
                        content={String(m.count)}
                        styles={styles.clusterText}
                      />
                    </View>
                  </Marker>
                );
              }
              return (
                <Marker
                  key={m.id}
                  coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                  onPress={() => handleMarkerPress(m)}
                >
                  <View style={[styles.marker, { backgroundColor: markerBg }]}>
                    <ThemeImage
                      styles={{ width: 16, height: 16 }}
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
          <View style={styles.loadingBadge}>
            <ThemeText
              content={t('screens.btcMap.map.loadingMerchants')}
              styles={styles.loadingText}
            />
          </View>
        )}

        <View style={[styles.fabStack, { bottom: bottomPadding }]}>
          <TouchableOpacity
            onPress={handleMyLocation}
            style={[styles.fab, { backgroundColor: backgroundOffset }]}
          >
            <ThemeIcon
              colorOverride={textColor}
              size={20}
              iconName="LocateFixed"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleZoomIn}
            style={[styles.fab, { backgroundColor: backgroundOffset }]}
          >
            <ThemeIcon colorOverride={textColor} size={20} iconName="Plus" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleZoomOut}
            style={[styles.fab, { backgroundColor: backgroundOffset }]}
          >
            <ThemeIcon colorOverride={textColor} size={20} iconName="Minus" />
          </TouchableOpacity>
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fabStack: { position: 'absolute', right: 16, gap: 8 },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  loadingBadge: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  loadingText: {
    fontSize: SIZES.small,
    color: COLORS.darkModeText,
    includeFontPadding: false,
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  clusterMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  clusterText: {
    fontSize: SIZES.smedium,
    fontFamily: 'Poppins-Bold',
    color: COLORS.darkModeText,
    includeFontPadding: false,
  },
});
