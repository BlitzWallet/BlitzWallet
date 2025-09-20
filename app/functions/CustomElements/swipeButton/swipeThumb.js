import {useCallback, useEffect, useState} from 'react';
import {
  I18nManager,
  StyleSheet,
  TouchableNativeFeedback,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import GetThemeColors from '../../../hooks/themeColors';
import {
  DEFAULT_ANIMATION_DURATION,
  RESET_AFTER_SUCCESS_DEFAULT_DELAY,
} from './constants';
import {COLORS} from '../../../constants';

const borderWidth = 3;
const margin = 2;
const maxContainerHeight = 100;

export const SwipeThumb = ({
  disabled = false,
  disableResetOnTap = false,
  enableReverseSwipe = false,
  forceReset,
  layoutWidth = 0,
  onSwipeFail,
  onSwipeStart,
  onSwipeSuccess,
  railStyles = {},
  resetAfterSuccessAnimDelay,
  resetAfterSuccessAnimDuration = 200,
  screenReaderEnabled = false,
  shouldResetAfterSuccess = true,
  swipeSuccessThreshold,
  thumbIconComponent: ThumbIconComponent,
  thumbIconHeight = 55,
  thumbIconStyles = {},
  thumbIconWidth,
  title,
  animateViewOnSuccess = () => {},
  handleSwipeProgress,
  theme,
}) => {
  const {backgroundColor} = GetThemeColors();
  const paddingAndMarginsOffset = borderWidth + 2 * margin;
  const defaultContainerWidth = thumbIconHeight;
  const maxWidth = layoutWidth - paddingAndMarginsOffset;
  const isRTL = I18nManager.isRTL;

  const [shouldDisableTouch, setShouldDisableTouch] = useState(false);

  const widthSV = useSharedValue(defaultContainerWidth);

  const reset = useCallback(() => {
    setShouldDisableTouch(false);
    widthSV.value = withTiming(defaultContainerWidth, {
      duration: DEFAULT_ANIMATION_DURATION,
    });
    if (handleSwipeProgress) runOnJS(handleSwipeProgress)(0);
  }, [defaultContainerWidth, handleSwipeProgress, widthSV]);

  const invokeOnSwipeSuccess = () => {
    setShouldDisableTouch(disableResetOnTap);
    animateViewOnSuccess();
    if (onSwipeSuccess) onSwipeSuccess();
  };

  const finishRemainingSwipe = () => {
    widthSV.value = withTiming(maxWidth, {
      duration: DEFAULT_ANIMATION_DURATION,
    });
    if (handleSwipeProgress) handleSwipeProgress(1);
    invokeOnSwipeSuccess();

    const resetDelay =
      DEFAULT_ANIMATION_DURATION +
      (resetAfterSuccessAnimDelay !== undefined
        ? resetAfterSuccessAnimDelay
        : RESET_AFTER_SUCCESS_DEFAULT_DELAY);

    setTimeout(() => {
      shouldResetAfterSuccess && reset();
    }, resetDelay);
  };

  const onSwipeNotMetSuccessThreshold = () => {
    reset();
    if (onSwipeFail) onSwipeFail();
  };

  const onSwipeMetSuccessThreshold = newWidth => {
    if (newWidth !== maxWidth) {
      finishRemainingSwipe();
      return;
    }
    invokeOnSwipeSuccess();
    reset();
  };

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      if (disabled) return;
      if (onSwipeStart) runOnJS(onSwipeStart)();
    })
    .onUpdate(e => {
      if (disabled) return;
      const reverseMultiplier = enableReverseSwipe ? -1 : 1;
      const rtlMultiplier = isRTL ? -1 : 1;
      const newWidth =
        defaultContainerWidth +
        rtlMultiplier * reverseMultiplier * e.translationX;

      if (newWidth < defaultContainerWidth) {
        runOnJS(reset)();
      } else if (newWidth > maxWidth) {
        widthSV.value = maxWidth;
        if (handleSwipeProgress) runOnJS(handleSwipeProgress)(1);
      } else {
        widthSV.value = newWidth;
        const progress =
          (newWidth - defaultContainerWidth) /
          (maxWidth - defaultContainerWidth);
        if (handleSwipeProgress) runOnJS(handleSwipeProgress)(progress);
      }
    })
    .onEnd(e => {
      if (disabled) return;
      const reverseMultiplier = enableReverseSwipe ? -1 : 1;
      const rtlMultiplier = isRTL ? -1 : 1;
      const newWidth =
        defaultContainerWidth +
        rtlMultiplier * reverseMultiplier * e.translationX;
      const successThresholdWidth = maxWidth * (swipeSuccessThreshold / 100);

      if (newWidth < successThresholdWidth) {
        runOnJS(onSwipeNotMetSuccessThreshold)();
      } else {
        runOnJS(onSwipeMetSuccessThreshold)(newWidth);
      }
    });

  useEffect(() => {
    if (forceReset) {
      forceReset(reset);
    }
  }, [forceReset, reset]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: widthSV.value,
  }));

  const renderThumbIcon = () => {
    const iconWidth = thumbIconWidth || thumbIconHeight;
    const dynamicStyles = {
      height: thumbIconHeight,
      width: iconWidth,
      backgroundColor: theme ? backgroundColor : COLORS.darkModeText,
      borderColor: theme ? backgroundColor : COLORS.darkModeText,
      overflow: 'hidden',
      ...thumbIconStyles,
    };

    return (
      <View style={[thumbStyles.icon, dynamicStyles]}>
        {ThumbIconComponent && <ThumbIconComponent />}
      </View>
    );
  };

  return screenReaderEnabled ? (
    <TouchableNativeFeedback
      accessibilityLabel={`${title}. ${
        disabled ? 'Disabled' : 'Double-tap to activate'
      }`}
      disabled={disabled}
      onPress={onSwipeSuccess}
      accessible>
      <View style={[thumbStyles.container, {width: defaultContainerWidth}]}>
        {renderThumbIcon()}
      </View>
    </TouchableNativeFeedback>
  ) : (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          enableReverseSwipe ? thumbStyles.containerRTL : thumbStyles.container,
          animatedStyle,
          {
            backgroundColor: theme ? backgroundColor : COLORS.darkModeText,
            borderColor: theme ? backgroundColor : COLORS.darkModeText,
            ...railStyles,
          },
        ]}
        pointerEvents={shouldDisableTouch ? 'none' : 'auto'}>
        {renderThumbIcon()}
      </Animated.View>
    </GestureDetector>
  );
};

const thumbStyles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    borderRadius: maxContainerHeight / 2,
    borderRightWidth: 0,
    borderWidth,
    margin,
  },
  containerRTL: {
    alignItems: 'flex-start',
    alignSelf: 'flex-end',
    borderRadius: maxContainerHeight / 2,
    borderLeftWidth: 0,
    borderWidth,
    margin,
  },
  icon: {
    alignItems: 'center',
    borderRadius: maxContainerHeight / 2,
    borderWidth: 2,
    justifyContent: 'center',
    marginVertical: -borderWidth,
  },
});
