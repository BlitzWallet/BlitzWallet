import {useCallback, useEffect, useRef, useState} from 'react';
import GetThemeColors from '../../../hooks/themeColors';
import {
  Animated,
  I18nManager,
  PanResponder,
  StyleSheet,
  TouchableNativeFeedback,
  View,
} from 'react-native';
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
  title = 'Swipe to submit',
  animateViewOnSuccess,
  handleSwipeProgress,
  theme,
}) => {
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const paddingAndMarginsOffset = borderWidth + 2 * margin;
  const defaultContainerWidth = thumbIconHeight;
  const maxWidth = layoutWidth - paddingAndMarginsOffset;
  const isRTL = I18nManager.isRTL;
  const animatedWidth = useRef(
    new Animated.Value(defaultContainerWidth),
  ).current;
  const [defaultWidth, setDefaultWidth] = useState(defaultContainerWidth);
  const [shouldDisableTouch, disableTouch] = useState(false);

  const reset = () => {
    disableTouch(false);
    setDefaultWidth(defaultContainerWidth);

    handleSwipeProgress && handleSwipeProgress(0);
  };

  const invokeOnSwipeSuccess = () => {
    disableTouch(disableResetOnTap);
    animateViewOnSuccess();
    onSwipeSuccess && onSwipeSuccess();
  };

  const finishRemainingSwipe = () => {
    // Animate to final position
    setDefaultWidth(maxWidth);

    handleSwipeProgress && handleSwipeProgress(1);

    invokeOnSwipeSuccess();

    // Animate back to initial position after successfully swiped
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
    // Animate to initial position
    setDefaultWidth(defaultContainerWidth);
    onSwipeFail && onSwipeFail();
    handleSwipeProgress && handleSwipeProgress(0);
  };

  const onSwipeMetSuccessThreshold = newWidth => {
    if (newWidth !== maxWidth) {
      finishRemainingSwipe();
      return;
    }
    invokeOnSwipeSuccess();
    reset();
  };

  const onPanResponderStart = () => {
    if (disabled) {
      return;
    }
    onSwipeStart && onSwipeStart();
  };

  const onPanResponderMove = async (event, gestureState) => {
    if (disabled) {
      return;
    }
    const reverseMultiplier = enableReverseSwipe ? -1 : 1;
    const rtlMultiplier = isRTL ? -1 : 1;
    const newWidth =
      defaultContainerWidth +
      rtlMultiplier * reverseMultiplier * gestureState.dx;

    if (newWidth < defaultContainerWidth) {
      // Reached starting position

      reset();
    } else if (newWidth > maxWidth) {
      // Reached end position

      setDefaultWidth(maxWidth);
      handleSwipeProgress && handleSwipeProgress(1);
    } else {
      Animated.timing(animatedWidth, {
        toValue: newWidth,
        duration: 0,
        useNativeDriver: false,
      }).start();
      setDefaultWidth(newWidth);

      const progress =
        (newWidth - defaultContainerWidth) / (maxWidth - defaultContainerWidth);
      handleSwipeProgress && handleSwipeProgress(progress);
    }
  };

  const onPanResponderRelease = (event, gestureState) => {
    if (disabled) {
      return;
    }
    const reverseMultiplier = enableReverseSwipe ? -1 : 1;
    const rtlMultiplier = isRTL ? -1 : 1;
    const newWidth =
      defaultContainerWidth +
      rtlMultiplier * reverseMultiplier * gestureState.dx;
    const successThresholdWidth = maxWidth * (swipeSuccessThreshold / 100);

    newWidth < successThresholdWidth
      ? onSwipeNotMetSuccessThreshold()
      : onSwipeMetSuccessThreshold(newWidth);
  };

  const panResponder = useCallback(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onShouldBlockNativeResponder: () => true,
      onPanResponderStart,
      onPanResponderMove,
      onPanResponderRelease,
    }),
    [
      disabled,
      enableReverseSwipe,
      maxWidth,
      defaultContainerWidth,
      swipeSuccessThreshold,
    ],
  );

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: defaultWidth,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [animatedWidth, defaultWidth]);

  useEffect(() => {
    forceReset && forceReset(reset);
  }, [forceReset]);

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
      <View style={[thumbStyles.icon, {...dynamicStyles}]}>
        {ThumbIconComponent && (
          <View>
            <ThumbIconComponent />
          </View>
        )}
      </View>
    );
  };

  const panStyle = {
    backgroundColor: theme ? backgroundColor : COLORS.darkModeText,
    borderColor: theme ? backgroundColor : COLORS.darkModeText,
    width: animatedWidth,
    ...(enableReverseSwipe ? thumbStyles.containerRTL : thumbStyles.container),
    ...railStyles,
  };

  return screenReaderEnabled ? (
    <TouchableNativeFeedback
      accessibilityLabel={`${title}. ${
        disabled ? 'Disabled' : 'Double-tap to activate'
      }`}
      disabled={disabled}
      onPress={onSwipeSuccess}
      accessible>
      <View style={[panStyle, {width: defaultContainerWidth}]}>
        {renderThumbIcon()}
      </View>
    </TouchableNativeFeedback>
  ) : (
    <Animated.View
      style={[panStyle]}
      {...panResponder.panHandlers}
      pointerEvents={shouldDisableTouch ? 'none' : 'auto'}>
      {renderThumbIcon()}
    </Animated.View>
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
