import React, { useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ThemeText } from '../functions/CustomElements';
import ThemeImage from '../functions/CustomElements/themeImage';
import { COLORS, ICONS } from '../constants';
import { useGlobalInsets } from '../../context-store/insetsProvider';
import { WINDOWWIDTH } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../hooks/themeColors';
import Icon from '../functions/CustomElements/Icon';
import displayCorrectDenomination from '../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../context-store/context';
import formatTokensNumber from '../functions/lrc20/formatTokensBalance';

export function Toast({ toast, onHide, fiatStats, sparkInformation }) {
  const { topPadding } = useGlobalInsets();
  const { t } = useTranslation();
  const { backgroundColor } = GetThemeColors();
  const { masterInfoObject } = useGlobalContextProvider();

  // shared values
  const slideY = useSharedValue(50);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isAnimatingOut = useRef(false);

  // Animate out
  const animateOut = useCallback(
    callback => {
      if (isAnimatingOut.current) return;
      isAnimatingOut.current = true;

      slideY.value = withTiming(-100, { duration: 300 });
      opacity.value = withTiming(0, { duration: 200 }, finished => {
        if (finished && callback) {
          runOnJS(callback)();
        }
      });
    },
    [opacity, slideY],
  );

  // Animate in
  useEffect(() => {
    slideY.value = withTiming(0, { duration: 200 });
    opacity.value = withTiming(1, { duration: 300 });
  }, [slideY, opacity]);

  // Gesture for swipe up
  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      if (event.translationY < 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd(event => {
      if (event.translationY < -topPadding) {
        runOnJS(animateOut)(onHide);
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: slideY.value + translateY.value }],
      opacity: opacity.value,
    };
  });

  const getToastStyle = () => {
    const baseStyle = [
      styles.toast,
      { borderWidth: 1, borderColor: backgroundColor },
    ];
    switch (toast.type) {
      case 'clipboard':
        return [...baseStyle, styles.clipboardToast];
      case 'confirmTx':
        return [...baseStyle, styles.clipboardToast];
      case 'error':
        return [...baseStyle, styles.errorToast];
      case 'warning':
        return [...baseStyle, styles.warningToast];
      case 'info':
        return [...baseStyle, styles.infoToast];
      default:
        return [...baseStyle, styles.defaultToast];
    }
  };

  const getIconForType = () => {
    switch (toast.type) {
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  const token = toast.isLRC20Payment
    ? sparkInformation.tokens?.[toast?.LRC20Token]
    : '';

  const formattedTokensBalance =
    toast.type === 'confirmTx' && !!token
      ? formatTokensNumber(toast.amount, token?.tokenMetadata?.decimals)
      : 0;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.toastContainer, { top: topPadding }, animatedStyle]}
      >
        <View style={getToastStyle()}>
          <View style={styles.toastContent}>
            {toast.type === 'clipboard' ? (
              <ThemeImage
                styles={{ width: 25, height: 25, marginRight: 15 }}
                lightModeIcon={ICONS.clipboardDark}
                darkModeIcon={ICONS.clipboardDark}
                lightsOutIcon={ICONS.clipboardDark}
              />
            ) : toast.type === 'confirmTx' ? (
              <View style={{ marginRight: 15 }}>
                <Icon
                  width={20}
                  height={20}
                  color={COLORS.lightModeText}
                  name={'expandedTxCheck'}
                />
              </View>
            ) : (
              <ThemeText styles={styles.toastIcon} content={getIconForType()} />
            )}
            <View style={styles.textContainer}>
              {toast.type === 'confirmTx' ? (
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={styles.toastTitle}
                  content={t('pushNotifications.LNURL.regular', {
                    totalAmount: displayCorrectDenomination({
                      amount: !!token ? formattedTokensBalance : toast.amount,
                      masterInfoObject,
                      fiatStats,
                      useCustomLabel: !!token,
                      customLabel: token?.tokenMetadata?.tokenTicker,
                      useMillionDenomination: true,
                    }),
                  })}
                />
              ) : (
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={styles.toastTitle}
                  content={t(toast.title)}
                />
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// Styles
const styles = StyleSheet.create({
  toastContainer: {
    width: WINDOWWIDTH,
    flex: 1,
    position: 'absolute',
    left: '2.5%',
    right: '2.5%',
    zIndex: 1000,
  },
  toast: {
    borderRadius: 8,
    padding: 15,
  },
  clipboardToast: {
    backgroundColor: COLORS.darkModeText,
  },
  successToast: {
    backgroundColor: '#4CAF50',
  },
  errorToast: {
    backgroundColor: '#F44336',
  },
  warningToast: {
    backgroundColor: '#FF9800',
  },
  infoToast: {
    backgroundColor: '#2196F3',
  },
  defaultToast: {
    backgroundColor: '#323232',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastIcon: {
    fontSize: 20,
    color: 'white',
    marginRight: 12,
    fontWeight: 'bold',
  },
  textContainer: {
    flex: 1,
  },
  toastTitle: {
    color: COLORS.lightModeText,
    includeFontPadding: false,
    flexShrink: 1,
  },
});
