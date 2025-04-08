// SplashScreen.js
import React, {useEffect, useMemo, useRef} from 'react';
import {View, StyleSheet, Animated} from 'react-native';
import LottieView from 'lottie-react-native';
import {COLORS} from '../constants';
import {useGlobalThemeContext} from '../../context-store/theme';
import {updateBlitzAnimationData} from '../functions/lottieViewColorTransformer';

const SplashScreen = ({onAnimationFinish}) => {
  const opacity = useRef(new Animated.Value(1)).current;
  const {theme, darkModeType} = useGlobalThemeContext();
  const BlitzAnimation = require('../assets/BlitzAnimation.json');

  const animationRef = useRef(null);

  const blueModeColor = {
    rectangleFill: [0.92157, 0.92157, 0.92157], // Dark blue-gray
    shapeFill: [0.011765, 0.458824, 0.964706, 1], // Same blue as before
  };

  const darkModeColor = {
    rectangleFill: [0, 0.1451, 0.3059],
    shapeFill: [0.011765, 0.458824, 0.964706, 1],
  };
  const lightsOutMode = {
    rectangleFill: [0, 0, 0],
    shapeFill: [1, 1, 1],
  };

  const darkModeAnimation = updateBlitzAnimationData(
    BlitzAnimation,
    theme ? lightsOutMode : blueModeColor,
  );

  useEffect(() => {
    setTimeout(() => {
      animationRef.current?.play();
    }, 250);

    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        if (onAnimationFinish) {
          onAnimationFinish();
        }
      });
    }, 2750);
  }, [opacity]);

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
      <Animated.View
        style={[
          styles.container,
          {
            opacity,
          },
        ]}>
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
    width: 150, // adjust as necessary
    height: 150, // adjust as necessary
  },
});

export default SplashScreen;
