// SplashScreen.js
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { COLORS } from '../constants';
import { useGlobalThemeContext } from '../../context-store/theme';
import { useNavigation } from '@react-navigation/native';

import * as ExpoSplashScreen from 'expo-splash-screen';
import { initializeAllDatabases } from '../functions/initializeAllDatabases';

const SplashLogo = require('../assets/adaptive-icon.png');

const SplashScreen = () => {
  const navigate = useNavigation();
  const opacity = useSharedValue(1);
  const didHideSplashRef = useRef(false);
  const { theme, darkModeType } = useGlobalThemeContext();

  useEffect(() => {
    // Fire database initialization in the background. The login page needs no
    // databases; the post-login loading screen awaits this same memoized
    // promise and surfaces any error, so the splash never blocks on DB work.
    initializeAllDatabases().catch(() => {});

    ExpoSplashScreen.setOptions({
      duration: 250,
      fade: true,
    });

    const goHome = () => navigate.replace('Home');
    opacity.value = withDelay(
      250,
      withTiming(0, { duration: 500 }, finished => {
        if (finished) scheduleOnRN(goHome);
      }),
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Hide the native splash only once this themed View has been laid out/painted,
  // so the gray (#EBEBEB) JS background is already on screen before the native
  // splash is torn down — otherwise the window flashes black during the handoff.
  // Mandatory: native auto-hide is disabled (MainActivity sets preventAutoHideCalled),
  // so the splash stays up until this call.
  const handleLayout = () => {
    if (didHideSplashRef.current) return;
    didHideSplashRef.current = true;
    ExpoSplashScreen.hideAsync();
  };

  return (
    <View
      onLayout={handleLayout}
      style={{
        flex: 1,
        backgroundColor: theme
          ? darkModeType
            ? COLORS.lightsOutBackground
            : COLORS.darkModeBackground
          : COLORS.lightModeBackground,
      }}
    >
      <Animated.View style={[styles.container, animatedStyle]}>
        <Image
          source={SplashLogo}
          style={[
            styles.logo,
            {
              tintColor:
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
            },
          ]}
          contentFit="contain"
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
  logo: {
    width: 131,
    height: 131,
  },
});

export default SplashScreen;
