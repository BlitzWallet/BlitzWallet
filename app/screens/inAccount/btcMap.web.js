import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  InteractionManager,
} from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useNavigation } from '@react-navigation/native';
import { useBTCMap } from '../../../context-store/btcMapContext';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import GetThemeColors from '../../hooks/themeColors';
import { SIZES } from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useAppStatus } from '../../../context-store/appStatus';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { COLORS, SHADOWS } from '../../constants/theme';
import { cameraToBbox } from '../../functions/btcMap/mapClustering';
import { resolvePlaceCategory } from '../../functions/btcMap/iconCategory';
import {
  clearBTCMapClusterCache,
  getOrBuildBTCMapClusterManager,
} from '../../functions/btcMap/btcMapClusterCache';
import { useTranslation } from 'react-i18next';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';

const DEFAULT_ZOOM = 13;
// OpenFreeMap vector tiles (https://openfreemap.org). No dedicated dark style
// exists there — 'liberty' is used for both themes.
// ponytail: single light style, add a dark style URL if dark-mode map matters.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

function buildMarkerEl(m, markerBg) {
  const el = document.createElement('div');
  el.style.cursor = 'pointer';
  el.style.boxSizing = 'border-box';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.border = '1px solid #fff';
  el.style.background = markerBg;
  el.style.color = COLORS.darkModeText;
  el.style.fontFamily = 'Poppins-Bold, sans-serif';
  if (m.type === 'cluster') {
    const size = m.count < 10 ? 40 : m.count < 100 ? 50 : 60;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = '50%';
    el.style.fontSize = '13px';
    el.style.fontWeight = '700';
    el.textContent = String(m.count);
  } else {
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.borderRadius = '50%';
    el.style.fontSize = '18px';
    el.style.fontWeight = '700';
    el.textContent = '₿';
  }
  return el;
}

export default function BTCMapScreen() {
  const navigate = useNavigation();
  const { screenDimensions } = useAppStatus();
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
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
  const markerBg = theme && darkModeType ? backgroundColor : COLORS.primary;
  const isFilterActive =
    filter.categories.length > 0 || filter.distanceUnit !== 'auto';
  const iconColor = theme && darkModeType ? textColor : COLORS.primary;

  const SCREEN_ASPECT_RATIO = screenDimensions.width / screenDimensions.height;
  const activeLocation = userLocation ?? DEFAULT_LOCATION;

  // DOM container + maplibre map instance + live marker DOM objects
  const containerRef = useRef(null);
  const mapObjRef = useRef(null);
  const markerObjsRef = useRef([]);

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

  const clusterManagerRef = useRef(null);
  const markersDataRef = useRef([]);
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

  // Request location then show map
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

  useEffect(() => {
    if (!isMapReady) return;
    buildClustersForViewport();
  }, [isMapReady, buildClustersForViewport]);

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

  // Keep latest handlers reachable from the map's imperative listeners without
  // re-binding them (which would tear down/rebuild the map on every render).
  const cameraChangeRef = useRef(handleCameraChange);
  cameraChangeRef.current = handleCameraChange;

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
        mapObjRef.current?.flyTo({
          center: [data.longitude, data.latitude],
          zoom: expansionZoom,
          duration: 400,
        });
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
  const markerPressRef = useRef(handleMarkerPress);
  markerPressRef.current = handleMarkerPress;

  // Create the maplibre map once the container is mounted
  useEffect(() => {
    if (!isMapReady || !containerRef.current || mapObjRef.current) return;
    const { lat, lon, zoom } = cameraRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [lon, lat],
      zoom,
      attributionControl: { compact: true },
    });
    mapObjRef.current = map;

    const onMoveEnd = () => {
      const c = map.getCenter();
      const z = map.getZoom();
      cameraChangeRef.current({
        latitude: c.lat,
        longitude: c.lng,
        latitudeDelta: 360 / Math.pow(2, z),
      });
    };
    map.on('moveend', onMoveEnd);

    return () => {
      map.off('moveend', onMoveEnd);
      map.remove();
      mapObjRef.current = null;
      markerObjsRef.current = [];
    };
  }, [isMapReady]);

  // Sync markers → maplibre marker DOM objects
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map) return;
    markerObjsRef.current.forEach(mk => mk.remove());
    markerObjsRef.current = [];
    markers.slice(0, 200).forEach(m => {
      const el = buildMarkerEl(m, markerBg);
      el.addEventListener('click', () => markerPressRef.current(m));
      const mk = new maplibregl.Marker({ element: el })
        .setLngLat([m.longitude, m.latitude])
        .addTo(map);
      markerObjsRef.current.push(mk);
    });
  }, [markers, markerBg]);

  const handleMyLocation = useCallback(async () => {
    try {
      const coords = await refreshLocation();
      if (coords) {
        mapObjRef.current?.flyTo({
          center: [coords.longitude, coords.latitude],
          zoom: 13,
          duration: 500,
        });
      }
    } catch (_) {}
  }, [refreshLocation]);

  const handleZoomIn = useCallback(() => {
    const map = mapObjRef.current;
    if (!map) return;
    map.easeTo({ zoom: Math.min(map.getZoom() + 2, 20), duration: 250 });
  }, []);

  const handleZoomOut = useCallback(() => {
    const map = mapObjRef.current;
    if (!map) return;
    map.easeTo({ zoom: Math.max(map.getZoom() - 2, 1), duration: 250 });
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
    const task = InteractionManager.runAfterInteractions(() => {
      syncPlaces();
    });
    return () => {
      task.cancel();
      clearBTCMapClusterCache();
    };
  }, [syncPlaces]);

  return (
    <GlobalThemeView styles={{ paddingTop: 0, paddingBottom: 0 }}>
      <View style={styles.container}>
        {!isMapReady && (
          <FullLoadingScreen text={t('screens.btcMap.map.loadingMap')} />
        )}

        {isMapReady && (
          <View ref={containerRef} style={StyleSheet.absoluteFillObject} />
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
              colorOverride={iconColor}
              size={20}
              iconName="LocateFixed"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleZoomIn}
            style={[styles.fab, { backgroundColor: backgroundOffset }]}
          >
            <ThemeIcon colorOverride={iconColor} size={20} iconName="Plus" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleZoomOut}
            style={[styles.fab, { backgroundColor: backgroundOffset }]}
          >
            <ThemeIcon colorOverride={iconColor} size={20} iconName="Minus" />
          </TouchableOpacity>
        </View>

        <View style={[styles.navbar, { top: topPadding }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigate.goBack()}
            style={[styles.navCircle, { backgroundColor }]}
          >
            <ThemeIcon
              colorOverride={iconColor}
              size={22}
              iconName="ArrowLeft"
            />
          </TouchableOpacity>

          <View style={[styles.navTitlePill, { backgroundColor }]}>
            <ThemeText
              CustomNumberOfLines={1}
              adjustsFontSizeToFit={true}
              styles={styles.navTitle}
              content={t('screens.btcMap.map.title')}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openFilter}
            style={[styles.navCircle, { backgroundColor }]}
          >
            <ThemeIcon
              colorOverride={iconColor}
              size={22}
              iconName="SlidersHorizontal"
            />
            {isFilterActive && (
              <View
                style={[
                  styles.filterBadge,
                  { backgroundColor: iconColor, borderColor: backgroundColor },
                ]}
              />
            )}
          </TouchableOpacity>
        </View>

        {isMapReady && !loading && placeCount > 0 && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openList}
            style={[
              styles.countPill,
              { bottom: bottomPadding, backgroundColor },
            ]}
          >
            <ThemeIcon colorOverride={textColor} size={16} iconName="List" />
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
  navCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  navTitlePill: {
    flex: 1,
    minHeight: 45,
    borderRadius: 26,
    paddingHorizontal: 20,
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  navTitle: {
    fontSize: SIZES.medium,
    textAlign: 'center',
    includeFontPadding: false,
  },
  filterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  countPill: {
    minHeight: 44,
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 24,
    ...SHADOWS.small,
  },
  countText: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
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
});
