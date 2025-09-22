import React, {useEffect, useRef, useState} from 'react';
import {View, StyleSheet, Text} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import ThemeText from './textTheme';
import {SIZES} from '../../constants';

export const SliderProgressAnimation = ({
  isVisible = false,
  textColor = '#FFFFFF',
  backgroundColor = '#010101ff',
  width = 0.95,
  containerStyles = {},
  ref,
}) => {
  const progress = useSharedValue(0);
  const slideUp = useSharedValue(0);
  const opacity = useSharedValue(0);
  const timeoutRef = useRef(null);
  const isCompletedRef = useRef(false);
  const [currentPercentage, setCurrentPercentage] = useState(0);

  useEffect(() => {
    if (isVisible && !isCompletedRef.current) {
      // Animate the progress indicator sliding up from the button
      slideUp.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
      });

      opacity.value = withTiming(1, {duration: 300});

      // Start initial 45-second animation to 90%
      progress.value = withTiming(0.9, {
        duration: 45000, // 45 seconds
      });

      // Update percentage text
      const updatePercentage = () => {
        const percentage = Math.round(progress.value * 100);
        runOnJS(setCurrentPercentage)(percentage);
      };

      // Set up interval to update percentage display
      const interval = setInterval(updatePercentage, 100);

      // After 45 seconds, start slow creep to 100% over 90 seconds
      timeoutRef.current = setTimeout(() => {
        if (!isCompletedRef.current) {
          progress.value = withTiming(1, {
            duration: 90000, // 90 seconds to go from 90% to 100%
          });
        }
      }, 45000);

      return () => {
        clearInterval(interval);
      };
    } else if (!isVisible) {
      // Reset animation
      isCompletedRef.current = false;
      progress.value = 0;
      slideUp.value = 0;
      opacity.value = 0;
      setCurrentPercentage(0);

      // Clear timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible]);

  // Function to complete progress immediately
  const completeProgress = () => {
    if (isCompletedRef.current) return;

    isCompletedRef.current = true;

    // Clear any pending timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Quickly animate to 100%
    progress.value = withTiming(
      1,
      {
        duration: 500,
      },
      finished => {
        if (finished) {
          runOnJS(setCurrentPercentage)(100);
        }
      },
    );
  };

  // Expose completeProgress function
  React.useImperativeHandle(
    ref,
    () => ({
      completeProgress,
    }),
    [],
  );

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        {
          translateY: interpolate(
            slideUp.value,
            [0, 1],
            [10, 0], // Slide up from 20px below
          ),
        },
        {
          scale: interpolate(
            slideUp.value,
            [0, 1],
            [0.9, 1], // Slight scale animation
          ),
        },
      ],
    };
  });

  const progressBarStyle = useAnimatedStyle(() => {
    return {
      width: `${interpolate(progress.value, [0, 1], [0, 100])}%`,
    };
  });

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        {
          width: typeof width === 'number' ? `${width * 100}%` : width,
          backgroundColor,
        },
        containerStyles,
      ]}>
      {/* Progress bar background */}
      <View
        style={[
          styles.progressBarContainer,
          {backgroundColor: 'rgba(255, 255, 255, 0.2)'},
        ]}>
        <Animated.View
          style={[
            styles.progressBar,
            {backgroundColor: 'rgba(255, 255, 255, 0.8)'},
            progressBarStyle,
          ]}
        />
      </View>

      {/* Percentage text */}
      <View style={styles.textContainer}>
        <ThemeText
          styles={{...styles.percentageText, color: textColor}}
          content={`${currentPercentage}%`}
        />
        {/* <ThemeText
          styles={{...styles.processingText, color: textColor}}
          content={'Processing'}
        /> */}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 15,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  textContainer: {
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 18,
    fontWeight: '500',
    includeFontPadding: false,
    // marginBottom: -4,
  },
  processingText: {
    fontSize: SIZES.xSmall,
    fontWeight: '400',
    opacity: 0.8,
    includeFontPadding: false,
  },
});
