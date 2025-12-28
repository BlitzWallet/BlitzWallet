import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  withSpring,
  runOnJS,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import ThemeText from './textTheme';
import FullLoadingScreen from './loadingScreen';

// Custom easing function: very fast start to reach ~20% in 2 seconds, then smooth deceleration
const initialEasing = Easing.bezier(0.29, 0.93, 0.85, 0.29); // Steep initial slope for fast 0-20%
// Custom easing for final creep: very slow to mimic processing hesitation
const creepEasing = Easing.bezier(0.1, 0.95, 0.2, 1);

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
  const isPausedRef = useRef(false);
  const pausedAtRef = useRef(0);
  const pauseTimeRef = useRef(0);
  const [currentPercentage, setCurrentPercentage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isVisible && !isCompletedRef.current) {
      // Animate the progress indicator sliding up from the button
      slideUp.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
      });

      opacity.value = withTiming(1, { duration: 300 });

      // Reach 90% in 45 seconds, with ~20% in first 2 seconds using custom easing
      progress.value = withTiming(0.9, {
        duration: 45000, // 45 seconds for 0-90%
        easing: initialEasing,
      });

      // Update percentage text
      const updatePercentage = () => {
        const percentage = Math.round(progress.value * 100);
        runOnJS(setCurrentPercentage)(percentage);
      };

      // Set up interval to update percentage display
      intervalRef.current = setInterval(updatePercentage, 100);

      // After 45 seconds, creep to 100% over 45 seconds (total 90 seconds)
      timeoutRef.current = setTimeout(() => {
        if (!isCompletedRef.current && !isPausedRef.current) {
          progress.value = withTiming(1, {
            duration: 90000, // 90 seconds to go from 90% to 100%
            easing: creepEasing,
          });
        }
      }, 45000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else if (!isVisible) {
      // Reset animation
      isCompletedRef.current = false;
      isPausedRef.current = false;
      pausedAtRef.current = 0;
      pauseTimeRef.current = 0;
      progress.value = 0;
      slideUp.value = 0;
      opacity.value = 0;
      setCurrentPercentage(0);

      // Clear timeouts and intervals
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible]);

  // Function to complete progress immediately
  const completeProgress = () => {
    if (isCompletedRef.current) return;

    isCompletedRef.current = true;
    setIsPaused(false);

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

  // Function to pause the animation
  const pauseProgress = () => {
    if (isCompletedRef.current || isPausedRef.current) return;

    isPausedRef.current = true;
    pausedAtRef.current = progress.value;
    pauseTimeRef.current = Date.now();
    setIsPaused(true);

    // Cancel ongoing animations
    cancelAnimation(progress);

    // Clear any pending timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Function to pause and reset to beginning
  const startAtBeginning = () => {
    if (isCompletedRef.current) return;

    isPausedRef.current = true;
    pausedAtRef.current = 0;
    pauseTimeRef.current = Date.now();
    setIsPaused(true);

    cancelAnimation(progress);

    progress.value = 0;

    setCurrentPercentage(0);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Function to resume the animation
  const startProgress = () => {
    if (isCompletedRef.current || !isPausedRef.current) return;

    setIsPaused(false);
    isPausedRef.current = false;
    const currentProgress = pausedAtRef.current;

    if (currentProgress < 0.9) {
      // Calculate remaining time for the initial phase (0-90%)
      const totalInitialDuration = 45000;
      const elapsedProgress = currentProgress / 0.9;
      const remainingDuration = totalInitialDuration * (1 - elapsedProgress);

      // Continue to 90%
      progress.value = withTiming(0.9, {
        duration: remainingDuration,
        easing: initialEasing,
      });

      // Schedule the creep phase
      timeoutRef.current = setTimeout(() => {
        if (!isCompletedRef.current && !isPausedRef.current) {
          progress.value = withTiming(1, {
            duration: 90000,
            easing: creepEasing,
          });
        }
      }, remainingDuration);
    } else {
      // Already in creep phase (90-100%)
      const remainingProgress = 1 - currentProgress;
      const totalCreepProgress = 0.1; // 90% to 100%
      const remainingRatio = remainingProgress / totalCreepProgress;
      const remainingDuration = 90000 * remainingRatio;

      // Continue to 100%
      progress.value = withTiming(1, {
        duration: remainingDuration,
        easing: creepEasing,
      });
    }
  };

  // Expose functions via ref
  React.useImperativeHandle(
    ref,
    () => ({
      completeProgress,
      pauseProgress,
      startProgress,
      startAtBeginning,
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
            [10, 0], // Slide up from 10px below
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
      ]}
    >
      {/* Progress bar background */}
      <View
        style={[
          styles.progressBarContainer,
          { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
        ]}
      >
        <Animated.View
          style={[
            styles.progressBar,
            { backgroundColor: 'rgba(255, 255, 255, 0.8)' },
            progressBarStyle,
          ]}
        />
      </View>

      {/* Percentage text */}
      <View style={styles.textContainer}>
        {isPaused ? (
          <FullLoadingScreen
            containerStyles={{ minWidth: 50, flex: 0 }}
            showText={false}
            size="small"
            loadingColor={textColor}
          />
        ) : (
          <ThemeText
            styles={{ ...styles.percentageText, color: textColor }}
            content={`${currentPercentage}%`}
          />
        )}
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
    marginRight: 5,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  textContainer: {
    alignItems: 'center',
  },
  percentageText: {
    minWidth: 50,
    fontWeight: '500',
    includeFontPadding: false,
    textAlign: 'right',
  },
});
