import { StyleSheet, TouchableOpacity, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';

const { width: deviceWidth } = Dimensions.get('window');
const PADDING_HORIZONTAL = 20;
const MAX_CONTAINER_WIDTH = (deviceWidth - PADDING_HORIZONTAL) * 0.9 - 24 * 2;

export default function DenominationToggle({
  setGiftDenomination,
  giftDenomination,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const sliderAnimation = useSharedValue(3);

  const [containerWidth, setContainerWidth] = useState(200);
  const [buttonWidth, setButtonWidth] = useState(95);
  const [btcTextWidth, setBtcTextWidth] = useState(0);
  const [usdTextWidth, setUsdTextWidth] = useState(0);

  useEffect(() => {
    if (btcTextWidth > 0 && usdTextWidth > 0) {
      const btcWidth = btcTextWidth + 10;
      const usdWidth = usdTextWidth + 10;

      const totalTextWidth = btcWidth + usdWidth;
      const containerPadding = 10;
      const calculatedWidth = totalTextWidth + containerPadding;

      const finalWidth = Math.min(calculatedWidth, MAX_CONTAINER_WIDTH);
      const finalButtonWidth = (finalWidth - containerPadding) / 2;

      setContainerWidth(finalWidth);
      setButtonWidth(finalButtonWidth - 3);
    }
  }, [btcTextWidth, usdTextWidth]);

  const handleSlide = useCallback(
    type => {
      sliderAnimation.value = withTiming(type === 'BTC' ? 3 : buttonWidth + 3, {
        duration: 200,
      });
    },
    [buttonWidth],
  );

  const handleBtcTextLayout = useCallback(event => {
    const { width } = event.nativeEvent.layout;
    setBtcTextWidth(width);
  }, []);

  const handleUsdTextLayout = useCallback(event => {
    const { width } = event.nativeEvent.layout;
    setUsdTextWidth(width);
  }, []);

  const btcFunction = useCallback(() => {
    setGiftDenomination('BTC');
    handleSlide('BTC');
  }, [handleSlide, setGiftDenomination]);

  const usdFunction = useCallback(() => {
    setGiftDenomination('USD');
    handleSlide('USD');
  }, [handleSlide, setGiftDenomination]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sliderAnimation.value }, { translateY: 3 }],
    backgroundColor: theme && darkModeType ? backgroundOffset : COLORS.primary,
    width: buttonWidth,
  }));

  return (
    <View
      style={[
        styles.sliderContainer,
        {
          backgroundColor: backgroundColor,
          alignItems: 'center',
          width: containerWidth,
        },
      ]}
    >
      <View style={styles.colorSchemeContainer}>
        <TouchableOpacity
          style={[styles.colorSchemeItemContainer, { width: buttonWidth + 3 }]}
          activeOpacity={1}
          onPress={btcFunction}
        >
          <ThemeText
            CustomNumberOfLines={1}
            styles={{
              ...styles.colorSchemeText,
              color:
                giftDenomination === 'BTC'
                  ? COLORS.darkModeText
                  : theme
                  ? COLORS.darkModeText
                  : COLORS.lightModeText,
            }}
            content={t('constants.bitcoin_upper')}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.colorSchemeItemContainer, { width: buttonWidth + 3 }]}
          activeOpacity={1}
          onPress={usdFunction}
        >
          <ThemeText
            CustomNumberOfLines={1}
            styles={{
              ...styles.colorSchemeText,
              color:
                giftDenomination === 'USD'
                  ? COLORS.darkModeText
                  : theme
                  ? COLORS.darkModeText
                  : COLORS.lightModeText,
            }}
            content={t('constants.dollars_upper')}
          />
        </TouchableOpacity>
        <Animated.View style={[styles.activeSchemeStyle, animatedStyle]} />
      </View>
      <ThemeText
        onLayout={handleBtcTextLayout}
        styles={styles.colorSchemeTextPlace}
        content={t('constants.bitcoin')}
      />
      <ThemeText
        onLayout={handleUsdTextLayout}
        styles={styles.colorSchemeTextPlace}
        content={t('constants.dollars')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sliderContainer: {
    paddingVertical: 5,
    borderRadius: 40,
  },
  colorSchemeContainer: {
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
    position: 'absolute',
    height: '100%',
    top: -3,
    left: 0,
    zIndex: -1,
    borderRadius: 30,
  },
});
