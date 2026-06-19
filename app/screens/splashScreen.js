// SplashScreen.js
import React, { useEffect } from 'react';
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

    // Idempotent so the animation callback and the fallback timer below can't
    // double-navigate. The fade callback only fires goHome on `finished`, so an
    // interrupted animation (app backgrounded mid-fade, tree unmount, dropped
    // worklet callback) would otherwise strand the user on a blank splash —
    // the timer guarantees navigation regardless.
    let didNavigate = false;
    const goHome = () => {
      if (didNavigate) return;
      didNavigate = true;
      navigate.replace('Home');
    };
    opacity.value = withDelay(
      250,
      withTiming(0, { duration: 500 }, () => {
        scheduleOnRN(goHome);
      }),
    );
    // Longer than the 250ms delay + 500ms fade, with margin.
    const fallbackNavigate = setTimeout(goHome, 900);

    // Native-splash safety net. On iOS hideAsync() resolves to a synchronous
    // native hide() that only acts while the loading view is on screen, and —
    // unlike Android (MainActivity sets preventAutoHideCalled) — iOS has no
    // synchronous auto-hide guard, so the native splash is torn down *only* by
    // our hideAsync() call. If the single onLayout call never lands (onLayout
    // not firing, or the hide running a frame too early), the splash stays up
    // forever. hideAsync() is idempotent (no-ops once the splash is gone), so
    // retry from this deterministic effect, after first paint, a few times.
    const hideTimers = [250, 750, 1500].map(delay =>
      setTimeout(() => ExpoSplashScreen.hideAsync().catch(() => {}), delay),
    );

    return () => {
      clearTimeout(fallbackNavigate);
      hideTimers.forEach(clearTimeout);
    };
  }, [opacity, navigate]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Primary native-splash hide: fire as soon as this themed View has been laid
  // out/painted, so the gray (#EBEBEB) JS background is already on screen before
  // the native splash is torn down — otherwise the window flashes black during
  // the handoff. The effect above retries in case this never fires.
  const hideNativeSplash = () => {
    ExpoSplashScreen.hideAsync().catch(() => {});
  };

  return (
    <View
      onLayout={hideNativeSplash}
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
