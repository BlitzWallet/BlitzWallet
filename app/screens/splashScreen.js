// SplashScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { CENTER, COLORS } from '../constants';
import { useGlobalThemeContext } from '../../context-store/theme';
import {
  applyErrorAnimationTheme,
  updateBlitzAnimationData,
} from '../functions/lottieViewColorTransformer';
import { initializeDatabase } from '../functions/messaging/cachedMessages';
import { initializeGiftCardDatabase } from '../functions/contacts/giftCardStorage';
import { initializePOSTransactionsDatabase } from '../functions/pos';
import { initializeSparkDatabase } from '../functions/spark/transactions';
import { initRootstockSwapDB } from '../functions/boltz/rootstock/swapDb';
import { GlobalThemeView, ThemeText } from '../functions/CustomElements';
import { t } from 'i18next';
import CustomButton from '../functions/CustomElements/button';
import { INSET_WINDOW_WIDTH } from '../constants/theme';
import openWebBrowser from '../functions/openWebBrowser';
import { useNavigation } from '@react-navigation/native';

import * as ExpoSplashScreen from 'expo-splash-screen';
const BlitzAnimation = require('../assets/BlitzAnimation.json');
const errorTxAnimation = require('../assets/errorTxAnimation.json');

const SplashScreen = () => {
  const navigate = useNavigation();
  const opacity = useSharedValue(1);
  const { theme, darkModeType } = useGlobalThemeContext();

  const [error, setError] = useState('');

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
  const errorAnimation = useMemo(() => {
    return applyErrorAnimationTheme(
      errorTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  useEffect(() => {
    async function loadAnimation() {
      ExpoSplashScreen.setOptions({
        duration: 250,
        fade: true,
      });
      ExpoSplashScreen.hideAsync();
      try {
        setTimeout(() => {
          animationRef.current?.play();
        }, 500);

        const [
          didOpen,
          giftCardTable,
          posTransactions,
          sparkTxs,
          rootstockSwaps,
        ] = await Promise.all([
          initializeDatabase(),
          initializeGiftCardDatabase(),
          initializePOSTransactionsDatabase(),
          initializeSparkDatabase(),
          initRootstockSwapDB(),
        ]);

        if (
          !didOpen ||
          !giftCardTable ||
          !posTransactions ||
          !sparkTxs ||
          !rootstockSwaps
        )
          throw new Error(t('screens.inAccount.loadingScreen.dbInitError'));

        setTimeout(() => {
          if (navigate) {
            navigate.replace('Home');
          } else {
            console.warn('navigationRef not yet ready');
          }
        }, 2750);
      } catch (err) {
        console.log('error loading databases');
        setError(err.message);
      }
    }
    loadAnimation();
  }, [opacity]);

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
      }}
    >
      {error ? (
        <GlobalThemeView useStandardWidth={true}>
          <View style={styles.errorContainer}>
            <LottieView
              ref={animationRef}
              source={errorAnimation}
              loop={false}
              style={{
                width: 225,
                height: 225,
              }}
            />
            <ThemeText
              styles={{
                textAlign: 'center',
                marginBottom: 15,
              }}
              content={t('screens.inAccount.loadingScreen.dbInitError1')}
            />
            <ThemeText
              styles={{
                textAlign: 'center',
                marginBottom: 20,
              }}
              content={t('screens.inAccount.loadingScreen.dbInitError2')}
            />
            <CustomButton
              actionFunction={() => {
                openWebBrowser({
                  navigate: navigate,
                  link: 'https://recover.blitzwalletapp.com/',
                });
              }}
              textContent={t('constants.recover')}
            />
          </View>
        </GlobalThemeView>
      ) : (
        <Animated.View style={[styles.container, animatedStyle]}>
          <LottieView
            ref={animationRef}
            source={darkModeAnimation}
            speed={0.8}
            loop={false}
            style={styles.lottie}
          />
        </Animated.View>
      )}
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

  errorContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    ...CENTER,
  },
});

export default SplashScreen;
