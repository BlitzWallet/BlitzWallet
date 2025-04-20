import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from 'react';
import {
  StyleSheet,
  Animated,
  AccessibilityInfo,
  useWindowDimensions,
  View,
} from 'react-native';
import {CENTER, COLORS, FONT, SIZES} from '../../constants';
import FullLoadingScreen from './loadingScreen';
import {useGlobalThemeContext} from '../../../context-store/theme';
import GetThemeColors from '../../hooks/themeColors';
import {
  DEFAULT_ANIMATION_DURATION,
  RESET_AFTER_SUCCESS_DEFAULT_DELAY,
  SHOULD_ANIMATE_VIEW_ON_SUCCESS,
  SWIPE_SUCCESS_THRESHOLD,
} from './swipeButton/constants';
import {SwipeThumb} from './swipeButton/swipeThumb';

// Container styles
const containerStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    ...CENTER,
  },
  title: {
    alignSelf: 'center',
    position: 'absolute',
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
    fontSize: SIZES.large,
  },
});

// Main SwipeButtonNew Component
const SwipeButtonNew = memo(function SwipeButtonNew({
  containerStyles: customContainerStyles = {},
  disabled = false,
  disableResetOnTap = false,
  enableReverseSwipe = false,
  forceReset,
  height = 55,
  onSwipeFail,
  onSwipeStart,
  onSwipeSuccess,
  railStyles = {},
  resetAfterSuccessAnimDelay,
  resetAfterSuccessAnimDuration,
  shouldResetAfterSuccess,
  swipeSuccessThreshold = SWIPE_SUCCESS_THRESHOLD,
  thumbIconComponent,
  thumbIconStyles = {},
  thumbIconWidth,
  title = 'Slide to confirm',
  shouldAnimateViewOnSuccess = SHOULD_ANIMATE_VIEW_ON_SUCCESS,
  width = 0.95,
  maxWidth = 375,
  shouldDisplaySuccessState = false,
}) {
  console.log('SWIPE BUTTON IS RENDERING');
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const windowDimensions = useWindowDimensions().width * width;
  const layoutWidth = windowDimensions > maxWidth ? maxWidth : windowDimensions;
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [isUnmounting, setIsUnmounting] = useState(false);

  const containerAnimatedWidth = useRef(
    new Animated.Value(layoutWidth),
  ).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const textTranslateX = useRef(new Animated.Value(0)).current;
  const loadingAnimationOpacity = useRef(new Animated.Value(0)).current;
  const [showLoadingIcon, setShowLoadingIcon] = useState(false);
  const prevPoint = useRef(0);

  const handleSwipeProgress = progress => {
    const jumpDistance = Math.abs(prevPoint.current - progress);
    prevPoint.current = progress;
    const shouldAnimate = jumpDistance > 0.1;
    // Update text opacity (1 -> 0)
    Animated.timing(textOpacity, {
      toValue: 1 - progress,
      duration: shouldAnimate ? 200 : 0,
      useNativeDriver: true,
    }).start();

    // Update text position (0 -> textSlideDistance)
    Animated.timing(textTranslateX, {
      toValue: progress * 100,
      duration: shouldAnimate ? 200 : 0,
      useNativeDriver: true,
    }).start();
  };

  const reset = () => {
    setShowLoadingIcon(false);
    Animated.timing(containerAnimatedWidth, {
      toValue: layoutWidth,
      duration: 200,
      useNativeDriver: false,
    }).start();
    Animated.timing(loadingAnimationOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const animateViewOnSuccess = () => {
    if (!shouldAnimateViewOnSuccess) return;
    const thumbSize = height + 3 + 2;
    setShowLoadingIcon(true);

    Animated.timing(containerAnimatedWidth, {
      toValue: thumbSize,
      duration: 200,
      useNativeDriver: false,
    }).start();
    Animated.timing(loadingAnimationOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();

    if (!shouldDisplaySuccessState && shouldResetAfterSuccess) {
      const resetDelay =
        DEFAULT_ANIMATION_DURATION +
        (resetAfterSuccessAnimDelay !== undefined
          ? resetAfterSuccessAnimDelay
          : RESET_AFTER_SUCCESS_DEFAULT_DELAY);

      setTimeout(() => {
        reset();
      }, resetDelay);
    }
  };

  useEffect(() => {
    if (shouldDisplaySuccessState) {
      animateViewOnSuccess();
    }
  }, [shouldDisplaySuccessState]);

  useEffect(() => {
    const handleScreenReaderToggled = isEnabled => {
      if (isUnmounting || screenReaderEnabled === isEnabled) {
        return;
      }
      setScreenReaderEnabled(isEnabled);
    };

    setIsUnmounting(false);

    let subscription;
    try {
      subscription = AccessibilityInfo.addEventListener(
        'change',
        handleScreenReaderToggled,
      );
    } catch (error) {
      // Fallback for older React Native versions
      AccessibilityInfo.addEventListener('change', handleScreenReaderToggled);
    }

    AccessibilityInfo.isScreenReaderEnabled().then(isEnabled => {
      if (isUnmounting) {
        return;
      }
      setScreenReaderEnabled(isEnabled);
    });

    return () => {
      setIsUnmounting(true);
      if (subscription && subscription.remove) {
        subscription.remove();
      } else {
        // Fallback for older React Native versions
        AccessibilityInfo.removeEventListener(
          'change',
          handleScreenReaderToggled,
        );
      }
    };
  }, [isUnmounting, screenReaderEnabled]);

  const railDynamicStyles = useMemo(() => {
    return {
      backgroundColor: showLoadingIcon
        ? COLORS.darkModeText
        : theme
        ? COLORS.darkModeText
        : COLORS.primary,
      borderColor: showLoadingIcon
        ? COLORS.darkModeText
        : theme
        ? backgroundOffset
        : backgroundColor,
    };
  }, [theme, darkModeType, showLoadingIcon]);

  const titleDynamicStyles = useMemo(() => {
    return {
      color: theme ? backgroundColor : COLORS.darkModeText,
    };
  }, [theme, darkModeType]);

  return (
    <Animated.View
      style={[
        containerStyles.container,
        {
          width: containerAnimatedWidth,
          ...railDynamicStyles,
          ...customContainerStyles,
          borderRadius: (height + 3 + 2) / 2,
        },
      ]}>
      {showLoadingIcon ? (
        <Animated.View
          style={{height: height + 3 + 2, opacity: loadingAnimationOpacity}}>
          <FullLoadingScreen
            loadingColor={COLORS.lightModeText}
            size="small"
            showText={false}
          />
        </Animated.View>
      ) : (
        <>
          <Animated.Text
            maxFontSizeMultiplier={1}
            ellipsizeMode={'tail'}
            numberOfLines={1}
            importantForAccessibility={
              screenReaderEnabled ? 'no-hide-descendants' : ''
            }
            style={[
              containerStyles.title,
              {
                opacity: textOpacity,
                transform: [{translateX: textTranslateX}],
                ...titleDynamicStyles,
              },
            ]}>
            {title}
          </Animated.Text>

          {layoutWidth > 0 && (
            <SwipeThumb
              disabled={disabled}
              disableResetOnTap={disableResetOnTap}
              enableReverseSwipe={enableReverseSwipe}
              forceReset={forceReset}
              layoutWidth={layoutWidth}
              onSwipeFail={onSwipeFail}
              onSwipeStart={onSwipeStart}
              onSwipeSuccess={onSwipeSuccess}
              railStyles={railStyles}
              resetAfterSuccessAnimDelay={resetAfterSuccessAnimDelay}
              resetAfterSuccessAnimDuration={resetAfterSuccessAnimDuration}
              screenReaderEnabled={screenReaderEnabled}
              shouldResetAfterSuccess={shouldResetAfterSuccess}
              swipeSuccessThreshold={swipeSuccessThreshold}
              thumbIconComponent={thumbIconComponent}
              thumbIconHeight={height}
              thumbIconStyles={thumbIconStyles}
              thumbIconWidth={thumbIconWidth}
              title={title}
              animateViewOnSuccess={animateViewOnSuccess}
              handleSwipeProgress={handleSwipeProgress}
              theme={theme}
            />
          )}
        </>
      )}
    </Animated.View>
  );
});

export default SwipeButtonNew;
