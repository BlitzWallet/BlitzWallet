import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import { COLORS, FONT, SIZES } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { useBTCMap } from '../../../../../context-store/btcMapContext';

const MAP_DELTA = 0.04;

const HAS_GOOGLE_MAPS_KEY = !!process.env.PUBLIC_GOOGLE_MAPS_API_KEY;

const DISABLED_MAP_PROPS = {
  scrollEnabled: false,
  zoomEnabled: false,
  rotateEnabled: false,
  pitchEnabled: false,
  showsCompass: false,
  showsUserLocation: false,
  showsMyLocationButton: false,
  showsPointsOfInterest: false,
  showsBuildings: false,
  showsTraffic: false,
  showsIndoors: false,
  toolbarEnabled: false,
};

function withAlpha(hexColor, alpha) {
  if (!hexColor || hexColor[0] !== '#') {
    return hexColor;
  }

  let normalized = hexColor.slice(1);
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map(char => `${char}${char}`)
      .join('');
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function MapPreview({ latitude, longitude, cardBackground, isDarkMode }) {
  const region = {
    latitude,
    longitude,
    latitudeDelta: MAP_DELTA,
    longitudeDelta: MAP_DELTA,
  };

  const mapWash = withAlpha(cardBackground, isDarkMode ? 0.28 : 0.2);
  const leftFade = [cardBackground, withAlpha(cardBackground, 0)];
  const topFade = [
    cardBackground,
    withAlpha(cardBackground, 0.65),
    withAlpha(cardBackground, 0),
  ];
  // const rightFade = [
  //   withAlpha(cardBackground, isDarkMode ? 0.2 : 0.98),
  //   withAlpha(cardBackground, 0),
  // ];
  // const bottomFade = [
  //   withAlpha(cardBackground, isDarkMode ? 0.2 : 0.04),
  //   withAlpha(cardBackground, 0),
  // ];

  return (
    <View style={styles.mapArea} pointerEvents="none">
      {Platform.OS === 'ios' || HAS_GOOGLE_MAPS_KEY ? (
        <MapView
          style={StyleSheet.absoluteFillObject}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={region}
          userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
          {...DISABLED_MAP_PROPS}
        ></MapView>
      ) : (
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: mapWash }]}
        />
      )}

      <LinearGradient
        colors={leftFade}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.leftFade}
        pointerEvents="none"
      />

      <LinearGradient
        colors={topFade}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.topFade}
        pointerEvents="none"
      />

      {/* <LinearGradient
        colors={rightFade}
        start={{ x: 1, y: 0.5 }}
        end={{ x: 0, y: 0.5 }}
        style={styles.rightFade}
        pointerEvents="none"
      /> */}

      {/* <LinearGradient
        colors={bottomFade}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={styles.bottomFade}
        pointerEvents="none"
      /> */}
    </View>
  );
}

export default function BTCMapPreviewCard() {
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const { userLocation, DEFAULT_LOCATION } = useBTCMap();

  const activeLocation = userLocation ?? DEFAULT_LOCATION;
  const mapCenter = {
    latitude: activeLocation.latitude,
    longitude: activeLocation.longitude,
  };

  const isDarkMode = theme;
  const cardBackground = backgroundColor;
  const borderColor =
    theme && darkModeType
      ? COLORS.tabsBorderLightsout
      : isDarkMode
      ? COLORS.tabsBorderDim
      : 'rgba(17,17,17,0.08)';
  const shadowOpacity = isDarkMode ? 0.18 : 0.08;

  return (
    <TouchableOpacity
      onPress={() => navigate.navigate('BTCMapScreen')}
      activeOpacity={0.92}
      style={[
        styles.container,
        {
          backgroundColor: cardBackground,
          borderColor,
          shadowOpacity,
        },
      ]}
    >
      <MapPreview
        latitude={mapCenter.latitude}
        longitude={mapCenter.longitude}
        cardBackground={cardBackground}
        isDarkMode={isDarkMode}
      />

      <View style={styles.textOverlay} pointerEvents="none">
        <ThemeText
          content={t('screens.btcMap.mapPreview.header')}
          styles={styles.overlayLabel}
        />
        <ThemeText
          content={t('screens.btcMap.mapPreview.subHeader')}
          styles={styles.overlayTitle}
          CustomNumberOfLines={1}
          adjustsFontSizeToFit={true}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
  },
  mapArea: {
    height: 320,
    overflow: 'hidden',
  },
  mapWash: {
    opacity: 1,
  },
  textOverlay: {
    position: 'absolute',
    top: 26,
    left: 24,
    right: 24,
    zIndex: 2,
    maxWidth: '80%',
  },
  overlayLabel: {
    fontSize: SIZES.medium,
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: FONT.Title_SemiBold,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
  overlayTitle: {
    fontSize: 34,
    lineHeight: 38,
    includeFontPadding: false,
  },
  leftFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '60%',
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  rightFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '10%',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '10%',
  },
});
