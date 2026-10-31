import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../functions/CustomElements';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import GetThemeColors from '../../hooks/themeColors';
import { useAppStatus } from '../../../context-store/appStatus';
import { useBTCMap } from '../../../context-store/btcMapContext';
import { CENTER, FONT, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import { getBtcMapIcon } from '../../functions/btcMap/iconMaping';
import {
  CATEGORY_META,
  resolvePlaceCategory,
} from '../../functions/btcMap/iconCategory';
import {
  distanceMeters,
  formatDistance,
} from '../../functions/btcMap/distance';
import PageHeader from '../../functions/CustomElements/redesign/PageHeader';
import ListCard, {
  ListDivider,
} from '../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../functions/CustomElements/redesign/ListRow';

const MAX_ROWS = 60;

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
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

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
      <ListRow
        onPress={() =>
          navigate.push('CustomHalfModal', {
            wantedContent: 'btcMapMerchant',
            placeId: item.id,
            source: item.source,
          })
        }
        lead={
          <View style={[styles.iconShell, { backgroundColor: tokens.surface }]}>
            <ThemeIcon
              iconName={getBtcMapIcon(item.icon)}
              size={20}
              colorOverride={tokens.ink}
              redesign
            />
          </View>
        }
        title={item.name || t('screens.btcMap.merchant.noName')}
        sub={t(CATEGORY_META[category].labelKey)}
        trailing={
          item.distance != null && (
            <ThemeText
              styles={[styles.rowDistance, { color: tokens.muted }]}
              content={formatDistance(item.distance, distanceUnit)}
            />
          )
        }
      />
    );
  };

  if (!places) {
    return <FullLoadingScreen showText={false} />;
  }

  return (
    <View style={[styles.container, { width: contentWidth }]}>
      <PageHeader
        title={t('screens.btcMap.map.placesHere', { count: placeCount })}
        showSub={false}
      />

      <ListCard style={styles.card} dividerInset={72}>
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={item => `${item.source}-${item.id}`}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={ListDivider}
          contentContainerStyle={[
            styles.listContent,
            !data.length && styles.emptyList,
          ]}
          ListEmptyComponent={
            <ThemeText
              styles={[styles.empty, { color: tokens.muted }]}
              content={t('screens.btcMap.map.noPlaces')}
            />
          }
        />
      </ListCard>

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
    ...CENTER,
  },
  card: { flexShrink: 1 },
  emptyList: {
    flexGrow: 1,
  },

  iconShell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 16,
    includeFontPadding: false,
  },
});
