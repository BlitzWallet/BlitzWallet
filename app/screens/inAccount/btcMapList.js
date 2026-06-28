import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../functions/CustomElements';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useAppStatus } from '../../../context-store/appStatus';
import { useBTCMap } from '../../../context-store/btcMapContext';
import { CENTER } from '../../constants';
import { COLORS, INSET_WINDOW_WIDTH, SIZES } from '../../constants/theme';
import { getBtcMapIcon } from '../../functions/btcMap/iconMaping';
import {
  CATEGORY_META,
  getBtcMapCategory,
} from '../../functions/btcMap/iconCategory';
import {
  distanceMeters,
  formatDistance,
} from '../../functions/btcMap/distance';

const MAX_ROWS = 500;

export default function BTCMapListContent({
  bbox,
  categories = [],
  distanceUnit = 'auto',
  userLocation,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { bottomPadding } = useGlobalInsets();
  const { screenDimensions } = useAppStatus();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundColor, backgroundOffset } = GetThemeColors();
  const { getPlacesInViewport } = useBTCMap();

  const [places, setPlaces] = useState(null);
  console.log(places);

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
      rows = rows.filter(p => categorySet.has(getBtcMapCategory(p.icon)));
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

  const iconShellColor =
    theme && darkModeType ? backgroundColor : backgroundOffset;
  const iconColor = theme && darkModeType ? textColor : COLORS.primary;

  const renderItem = ({ item }) => {
    const category = getBtcMapCategory(item.icon);
    return (
      <TouchableOpacity
        activeOpacity={0.6}
        style={[styles.row, { borderBottomColor: backgroundOffset }]}
        onPress={() =>
          navigate.push('CustomHalfModal', {
            wantedContent: 'btcMapMerchant',
            placeId: item.id,
          })
        }
      >
        <View style={[styles.iconShell, { backgroundColor: iconShellColor }]}>
          <ThemeIcon
            iconName={getBtcMapIcon(item.icon)}
            size={20}
            colorOverride={iconColor}
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
            styles={styles.rowCategory}
            content={t(CATEGORY_META[category].labelKey)}
          />
        </View>

        {item.distance != null && (
          <ThemeText
            styles={styles.rowDistance}
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
        content={t('screens.btcMap.map.placesHere', { count: data.length })}
      />

      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={item => String(item.id)}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ right: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPadding + 20 }}
        ListEmptyComponent={
          <ThemeText
            styles={styles.empty}
            content={t('screens.btcMap.map.noPlaces')}
          />
        }
      />
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
    fontFamily: 'Poppins-Medium',
    marginBottom: 16,
    includeFontPadding: false,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
    borderBottomWidth: 1,
  },
  iconShell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  rowCategory: {
    fontSize: SIZES.small,
    opacity: 0.5,
    includeFontPadding: false,
    marginTop: 2,
  },
  rowDistance: {
    fontSize: SIZES.small,
    opacity: 0.6,
    includeFontPadding: false,
    marginLeft: 8,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    opacity: 0.7,
  },
});
