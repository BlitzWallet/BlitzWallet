import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../functions/CustomElements';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import GetThemeColors from '../../hooks/themeColors';
import { useAppStatus } from '../../../context-store/appStatus';
import { useBTCMap } from '../../../context-store/btcMapContext';
import { CENTER, FONT } from '../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../constants/theme';
import { getBtcMapIcon } from '../../functions/btcMap/iconMaping';
import {
  CATEGORY_META,
  resolvePlaceCategory,
} from '../../functions/btcMap/iconCategory';
import {
  distanceMeters,
  formatDistance,
} from '../../functions/btcMap/distance';

const MAX_ROWS = 60;

function BTCMapListSeparator() {
  const { tokens } = GetThemeColors();
  return (
    <View style={[styles.rowSeparator, { backgroundColor: tokens.divider }]} />
  );
}

export default function BTCMapListContent({
  bbox,
  categories = [],
  distanceUnit = 'auto',
  userLocation,
  setContentHeight,
  placeCount,
}) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { screenDimensions } = useAppStatus();
  const { tokens } = GetThemeColors();
  const { getPlacesInViewport } = useBTCMap();

  const [places, setPlaces] = useState(null);

  useEffect(() => {
    setContentHeight(screenDimensions.height * 0.85);
  }, [setContentHeight, screenDimensions.height]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!bbox) {
        setPlaces([]);
        return;
      }
      const [minLon, minLat, maxLon, maxLat] = bbox;
      try {
        const rows = await getPlacesInViewport(minLat, maxLat, minLon, maxLon);
        if (!cancelled) setPlaces(rows);
      } catch (_) {
        if (!cancelled) setPlaces([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bbox, getPlacesInViewport]);

  const data = useMemo(() => {
    if (!places) return [];
    const categorySet = categories.length ? new Set(categories) : null;
    let rows = places;
    if (categorySet) {
      rows = rows.filter(p => categorySet.has(resolvePlaceCategory(p)));
    }
    rows = rows.map(p => ({
      ...p,
      distance: userLocation
        ? distanceMeters(
            userLocation.latitude,
            userLocation.longitude,
            p.lat,
            p.lon,
          )
        : null,
    }));
    if (userLocation) {
      rows.sort((a, b) => a.distance - b.distance);
    }
    return rows.slice(0, MAX_ROWS);
  }, [places, categories, userLocation]);

  const hasMoreRows = data?.length < placeCount;

  const renderItem = ({ item }) => {
    const category = resolvePlaceCategory(item);
    return (
      <TouchableOpacity
        activeOpacity={0.6}
        style={styles.row}
        onPress={() =>
          navigate.push('CustomHalfModal', {
            wantedContent: 'btcMapMerchant',
            placeId: item.id,
            source: item.source,
          })
        }
      >
        <View style={[styles.iconShell, { backgroundColor: tokens.disc }]}>
          <ThemeIcon
            iconName={getBtcMapIcon(item.icon)}
            size={20}
            colorOverride={tokens.ink}
            redesign
          />
        </View>

        <View style={styles.rowText}>
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.rowName}
            content={item.name || t('screens.btcMap.merchant.noName')}
          />
          <ThemeText
            CustomNumberOfLines={1}
            styles={[styles.rowCategory, { color: tokens.muted }]}
            content={t(CATEGORY_META[category].labelKey)}
          />
        </View>

        {item.distance != null && (
          <ThemeText
            styles={[styles.rowDistance, { color: tokens.muted }]}
            content={formatDistance(item.distance, distanceUnit)}
          />
        )}
      </TouchableOpacity>
    );
  };

  if (!places) {
    return <FullLoadingScreen showText={false} />;
  }

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.header}
        content={t('screens.btcMap.map.placesHere', { count: placeCount })}
      />

      <View style={[styles.listCard, { backgroundColor: tokens.ground }]}>
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={item => `${item.source}-${item.id}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            !data.length && styles.emptyList,
          ]}
          ItemSeparatorComponent={BTCMapListSeparator}
          ListEmptyComponent={
            <ThemeText
              styles={[styles.empty, { color: tokens.muted }]}
              content={t('screens.btcMap.map.noPlaces')}
            />
          }
        />
      </View>
      {hasMoreRows && (
        <ThemeText
          styles={[styles.hasMoreMessage, { color: tokens.muted }]}
          content={t('screens.btcMap.map.hasMorePlaces', { num: MAX_ROWS })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  header: {
    fontSize: SIZES.large,
    lineHeight: 26,
    fontFamily: FONT.Title_Regular,
    marginTop: 20,
    marginBottom: 12,
    includeFontPadding: false,
  },
  listCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    gap: 12,
  },
  rowSeparator: {
    height: 1,
    marginLeft: 56,
  },
  iconShell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  rowCategory: {
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  rowDistance: {
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    marginLeft: 8,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  hasMoreMessage: {
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 16,
    includeFontPadding: false,
  },
});
