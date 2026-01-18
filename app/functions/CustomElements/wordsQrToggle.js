import { StyleSheet, TouchableOpacity, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import GetThemeColors from '../../hooks/themeColors';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ThemeText from './textTheme';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useAppStatus } from '../../../context-store/appStatus';

export default function WordsQrToggle({
  setSelectedDisplayOption,
  selectedDisplayOption,
  canViewQrCode,
  qrNavigateFunc,
}) {
  const { screenDimensions } = useAppStatus();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const navigate = useNavigation();

  const sliderAnimation = useSharedValue(3);

  const [containerWidth, setContainerWidth] = useState(999);
  const [buttonWidth, setButtonWidth] = useState(999);
  const [wordsTextWidth, setWordsTextWidth] = useState(0);
  const [qrTextWidth, setQrTextWidth] = useState(0);

  const MAX_CONTAINER_WIDTH = useMemo(() => {
    return Math.round(screenDimensions.width * 0.9);
  }, [screenDimensions.width]);

  useEffect(() => {
    if (wordsTextWidth > 0 && qrTextWidth > 0) {
      const textPadding = 20;
      const wordsWidth = wordsTextWidth + textPadding;
      const qrWidth = qrTextWidth + textPadding;

      const maxTextWidth = Math.max(wordsWidth, qrWidth);

      const containerPadding = 10;

      const idealWidth = maxTextWidth * 2 + containerPadding;

      const finalWidth = Math.min(idealWidth, MAX_CONTAINER_WIDTH);

      const finalButtonWidth = (finalWidth - containerPadding) / 2;

      setContainerWidth(finalWidth);
      setButtonWidth(finalButtonWidth);
    }
  }, [wordsTextWidth, qrTextWidth, MAX_CONTAINER_WIDTH]);

  useEffect(() => {
    if (!canViewQrCode) return;
    setSelectedDisplayOption('qrcode');
    handleSlide('qrcode');
  }, [canViewQrCode]);

  const handleSlide = useCallback(
    type => {
      sliderAnimation.value = withTiming(
        type === 'words' ? 3 : buttonWidth + 7,
        { duration: 200 },
      );
    },
    [buttonWidth],
  );

  const handleWordsTextLayout = useCallback(event => {
    const { width } = event.nativeEvent.layout;
    setWordsTextWidth(width);
  }, []);

  const handleQrTextLayout = useCallback(event => {
    const { width } = event.nativeEvent.layout;
    setQrTextWidth(width);
  }, []);

  const wordsFunction = useCallback(() => {
    setSelectedDisplayOption('words');
    handleSlide('words');
  }, [handleSlide]);

  const qrFunction = useCallback(() => {
    if (!canViewQrCode) {
      navigate.navigate('InformationPopup', {
        textContent: t('settings.seedPhrase.qrWarning'),
        buttonText: t('constants.understandText'),
        customNavigation: qrNavigateFunc,
      });
      return;
    }
    setSelectedDisplayOption('qrcode');
    handleSlide('qrcode');
  }, [canViewQrCode, navigate, handleSlide]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sliderAnimation.value }, { translateY: 3 }],
    backgroundColor: theme && darkModeType ? backgroundColor : COLORS.primary,
    width: buttonWidth - 6,
  }));

  return (
    <View
      style={[
        styles.sliderContainer,
        {
          backgroundColor: backgroundOffset,
          alignItems: 'center',
          width: containerWidth,
        },
      ]}
    >
      <View style={styles.colorSchemeContainer}>
        <TouchableOpacity
          style={[styles.colorSchemeItemContainer, { width: buttonWidth }]}
          activeOpacity={1}
          onPress={wordsFunction}
        >
          <ThemeText
            CustomNumberOfLines={1}
            CustomEllipsizeMode="tail"
            styles={{
              ...styles.colorSchemeText,
              color:
                selectedDisplayOption === 'words'
                  ? COLORS.darkModeText
                  : theme
                  ? COLORS.darkModeText
                  : COLORS.lightModeText,
            }}
            content={t('settings.seedPhrase.wordsText')}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.colorSchemeItemContainer, { width: buttonWidth }]}
          activeOpacity={1}
          onPress={qrFunction}
        >
          <ThemeText
            CustomNumberOfLines={1}
            CustomEllipsizeMode="tail"
            styles={{
              ...styles.colorSchemeText,
              color:
                selectedDisplayOption === 'qrcode'
                  ? COLORS.darkModeText
                  : theme
                  ? COLORS.darkModeText
                  : COLORS.lightModeText,
            }}
            content={t('settings.seedPhrase.qrText')}
          />
        </TouchableOpacity>
        <Animated.View style={[styles.activeSchemeStyle, animatedStyle]} />
      </View>
      {/* Hidden measurement text */}
      <ThemeText
        onLayout={handleWordsTextLayout}
        styles={styles.colorSchemeTextPlace}
        content={t('settings.seedPhrase.wordsText')}
      />
      <ThemeText
        onLayout={handleQrTextLayout}
        styles={styles.colorSchemeTextPlace}
        content={t('settings.seedPhrase.qrText')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sliderContainer: {
    paddingVertical: 5,
    borderRadius: 40,
    marginTop: 20,
  },
  colorSchemeContainer: {
    flexDirection: 'row',
    position: 'relative',
    zIndex: 1,
  },
  colorSchemeItemContainer: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSchemeTextPlace: {
    position: 'absolute',
    zIndex: -1,
    opacity: 0,
    paddingHorizontal: 10,
    includeFontPadding: false,
  },
  colorSchemeText: {
    width: '100%',
    includeFontPadding: false,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  activeSchemeStyle: {
    position: 'absolute',
    height: '100%',
    top: -3,
    left: 0,
    zIndex: -1,
    borderRadius: 30,
  },
});
