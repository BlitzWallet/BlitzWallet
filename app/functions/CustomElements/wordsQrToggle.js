import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import GetThemeColors from '../../hooks/themeColors';
import { useCallback, useEffect, useMemo } from 'react';
import ThemeText from './textTheme';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useAppStatus } from '../../../context-store/appStatus';

export default function WordsQrToggle({
  setSelectedDisplayOption,
  selectedDisplayOption,
  option1Text,
  option2Text,
  option1Value = 'words',
  option2Value = 'qrcode',
  canViewOption2,
  option2BlockedNavFunc,
  containerStyle,
}) {
  const { screenDimensions } = useAppStatus();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const navigate = useNavigation();

  // Size the toggle synchronously from the screen width instead of measuring
  // text via onLayout. Async measurement raced the navigation transition on the
  // first popTo mount, leaving the pill stuck at its fallback width.
  const { containerWidth, buttonWidth } = useMemo(() => {
    const containerPadding = 10;
    const finalWidth = Math.min(Math.round(screenDimensions.width * 0.9), 500);

    return {
      containerWidth: finalWidth,
      buttonWidth: (finalWidth - containerPadding) / 2,
    };
  }, [screenDimensions.width]);

  useEffect(() => {
    if (canViewOption2 === undefined) return;
    if (!canViewOption2) return;

    setSelectedDisplayOption(option2Value);
  }, [canViewOption2]);

  const wordsFunction = useCallback(() => {
    setSelectedDisplayOption(option1Value);
  }, [selectedDisplayOption, option1Value]);

  const qrFunction = useCallback(() => {
    if (canViewOption2 !== undefined && !canViewOption2) {
      navigate.navigate('InformationPopup', {
        textContent: t('settings.seedPhrase.qrWarning'),
        buttonText: t('constants.understandText'),
        customNavigation: option2BlockedNavFunc,
      });
      return;
    }

    setSelectedDisplayOption(option2Value);
  }, [
    canViewOption2,
    selectedDisplayOption,
    navigate,
    option2Value,
    option2BlockedNavFunc,
  ]);

  // Drive the pill position purely from the controlled selection so it stays
  // correct on every render/reattach (e.g. returning from a pushed screen via
  // popTo) with no separate animation state that can drift out of sync.
  const animatedStyle = useAnimatedStyle(() => {
    const target = selectedDisplayOption === option1Value ? 0 : buttonWidth;
    return {
      transform: [
        { translateX: withTiming(target, { duration: 200 }) },
        { translateY: 3 },
      ],
      backgroundColor:
        theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
      width: buttonWidth,
    };
  });

  return (
    <View
      style={[
        styles.sliderContainer,
        {
          backgroundColor: backgroundOffset,
          alignItems: 'center',
          width: containerWidth,
        },
        containerStyle,
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
                selectedDisplayOption === option1Value
                  ? theme && darkModeType
                    ? COLORS.lightModeText
                    : COLORS.darkModeText
                  : theme
                  ? COLORS.darkModeText
                  : COLORS.lightModeText,
            }}
            content={option1Text}
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
                selectedDisplayOption === option2Value
                  ? theme && darkModeType
                    ? COLORS.lightModeText
                    : COLORS.darkModeText
                  : theme
                  ? COLORS.darkModeText
                  : COLORS.lightModeText,
            }}
            content={option2Text}
          />
        </TouchableOpacity>
        <Animated.View style={[styles.activeSchemeStyle, animatedStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sliderContainer: {
    paddingVertical: 5,
    borderRadius: 999,
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
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});
