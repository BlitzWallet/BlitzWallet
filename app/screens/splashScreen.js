// SplashScreen.js
import React, {useEffect, useMemo, useRef} from 'react';
import {View, StyleSheet, Animated} from 'react-native';
import LottieView from 'lottie-react-native';
import {COLORS} from '../constants';
import {useGlobalThemeContext} from '../../context-store/theme';

const SplashScreen = ({onAnimationFinish}) => {
  const opacity = useRef(new Animated.Value(1)).current;
  const {theme, darkModeType} = useGlobalThemeContext();

  const animationRef = useRef(null);

  const animationSource = useMemo(() => {
    return theme
      ? darkModeType
        ? require('../assets/BlitzAnimationLightsOut.json')
        : require('../assets/BlitzAnimationDM.json')
      : require('../assets/BlitzAnimation.json');
  }, [theme, darkModeType]);

  useEffect(() => {
    animationRef.current?.play();
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
    }, 2500);
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
          source={animationSource}
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
