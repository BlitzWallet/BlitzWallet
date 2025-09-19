// SplashScreen.js
import React, {useEffect, useRef} from 'react';
import {View, StyleSheet} from 'react-native';
import LottieView from 'lottie-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {COLORS} from '../constants';
import {useGlobalThemeContext} from '../../context-store/theme';
import {updateBlitzAnimationData} from '../functions/lottieViewColorTransformer';

const SplashScreen = ({onAnimationFinish}) => {
  const opacity = useSharedValue(1);
  const {theme, darkModeType} = useGlobalThemeContext();
  const BlitzAnimation = require('../assets/BlitzAnimation.json');

  const animationRef = useRef(null);

  const blueModeColor = {
    rectangleFill: [0.92157, 0.92157, 0.92157],
    shapeFill: [0.011765, 0.458824, 0.964706, 1],
  };

  const darkModeColor = {
    rectangleFill: [0, 0.1451, 0.3059],
    shapeFill: [1, 1, 1],
  };

  const lightsOutMode = {
    rectangleFill: [0, 0, 0],
    shapeFill: [1, 1, 1],
  };

  const darkModeAnimation = updateBlitzAnimationData(
    BlitzAnimation,
    theme ? (darkModeType ? lightsOutMode : darkModeColor) : blueModeColor,
  );

  useEffect(() => {
    setTimeout(() => {
      animationRef.current?.play();
    }, 250);

    setTimeout(() => {
      opacity.value = withTiming(0, {duration: 500}, isFinished => {
        if (isFinished && onAnimationFinish) {
          runOnJS(onAnimationFinish)();
        }
      });
    }, 2750);
  }, [opacity, onAnimationFinish]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme
          ? darkModeType
            ? COLORS.lightsOutBackground
            : COLORS.darkModeBackground
          : COLORS.lightModeBackground,
      }}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <LottieView
          ref={animationRef}
          source={darkModeAnimation}
          speed={0.8}
          loop={false}
          style={styles.lottie}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: 150,
    height: 150,
  },
});

export default SplashScreen;
