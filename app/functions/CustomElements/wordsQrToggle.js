import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import GetThemeColors from '../../hooks/themeColors';
import {useCallback, useEffect, useRef, useState} from 'react';
import ThemeText from './textTheme';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import {COLORS} from '../../constants';
import {useGlobalThemeContext} from '../../../context-store/theme';

const {width: deviceWidth} = Dimensions.get('window');
const PADDING_HORIZONTAL = 20; // Total horizontal padding for container
const MAX_CONTAINER_WIDTH = deviceWidth - PADDING_HORIZONTAL;

export default function WordsQrToggle({
  setSelectedDisplayOption,
  selectedDisplayOption,
  canViewQrCode,
  qrNavigateFunc,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const {t} = useTranslation();
  const navigate = useNavigation();
  const sliderAnimation = useRef(new Animated.Value(3)).current;

  const [containerWidth, setContainerWidth] = useState(200);
  const [buttonWidth, setButtonWidth] = useState(95);
  const [wordsTextWidth, setWordsTextWidth] = useState(0);
  const [qrTextWidth, setQrTextWidth] = useState(0);

  useEffect(() => {
    if (wordsTextWidth > 0 && qrTextWidth > 0) {
      const wordsWidth = wordsTextWidth + 10;
      const qrWidth = qrTextWidth + 10;

      const totalTextWidth = wordsWidth + qrWidth;
      const containerPadding = 10;
      const calculatedWidth = totalTextWidth + containerPadding;

      const finalWidth = Math.min(calculatedWidth, MAX_CONTAINER_WIDTH);
      const finalButtonWidth = (finalWidth - containerPadding) / 2;

      setContainerWidth(finalWidth);
      setButtonWidth(finalButtonWidth - 3);
    }
  }, [wordsTextWidth, qrTextWidth]);

  useEffect(() => {
    if (!canViewQrCode) return;
    setSelectedDisplayOption('qrcode');
    handleSlide('qrcode');
  }, [canViewQrCode]);

  const handleSlide = useCallback(
    type => {
      Animated.timing(sliderAnimation, {
        toValue: type === 'words' ? 3 : buttonWidth + 3,
        duration: 200,
        useNativeDriver: true,
      }).start();
    },
    [buttonWidth],
  );

  const handleWordsTextLayout = useCallback(event => {
    const {width} = event.nativeEvent.layout;
    console.log(width, 'testing1');
    setWordsTextWidth(width);
  }, []);

  const handleQrTextLayout = useCallback(event => {
    const {width} = event.nativeEvent.layout;
    console.log(width, 'testing');
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

  return (
    <View
      style={[
        styles.sliderContainer,
        {
          backgroundColor: backgroundOffset,
          alignItems: 'center',
          width: containerWidth,
        },
      ]}>
      <View style={styles.colorSchemeContainer}>
        <TouchableOpacity
          style={[styles.colorSchemeItemContainer, {width: buttonWidth + 3}]}
          activeOpacity={1}
          onPress={wordsFunction}>
          <ThemeText
            CustomNumberOfLines={1}
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
          style={[styles.colorSchemeItemContainer, {width: buttonWidth + 3}]}
          activeOpacity={1}
          onPress={qrFunction}>
          <ThemeText
            CustomNumberOfLines={1}
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
        <Animated.View
          style={[
            styles.activeSchemeStyle,
            {
              transform: [{translateX: sliderAnimation}, {translateY: 3}],
              backgroundColor:
                theme && darkModeType ? backgroundColor : COLORS.primary,
              width: buttonWidth,
            },
          ]}
        />
      </View>
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
    height: 'auto',
    flexDirection: 'row',
    position: 'relative',
    zIndex: 1,
  },
  colorSchemeItemContainer: {
    paddingVertical: 8,
    alignItems: 'center',
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
    backgroundColor: COLORS.primary,
    position: 'absolute',
    height: '100%',
    top: -3,
    left: 0,
    zIndex: -1,
    borderRadius: 30,
  },
});
