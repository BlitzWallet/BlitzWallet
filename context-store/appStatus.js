import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { AppState, Dimensions, Platform } from 'react-native';
import { getBoltzSwapPairInformation } from '../app/functions/boltz/boltzSwapInfo';
import * as Network from 'expo-network';
import { navigationRef } from '../navigation/navigationService';
import {
  BACKGROUND_THRESHOLD_MS,
  // FORCE_RESET_SPAARK_STATE_MS,
} from '../app/constants';

// Initiate context
const AppStatusManager = createContext(null);

const AppStatusProvider = ({ children }) => {
  const [minMaxLiquidSwapAmounts, setMinMaxLiquidSwapAmounts] = useState({
    min: 1000,
    max: 25000000,
    rsk: {
      min: 3000,
      max: 10000000,
    },
  });
  const [isConnectedToTheInternet, setIsConnectedToTheInternet] =
    useState(true);
  const [didGetToHomepage, setDidGetToHomePage] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [isAppFocused, setIsAppFocused] = useState(true);
  const [screenDimensions, setScreenDimensions] = useState(() =>
    Dimensions.get('screen'),
  );
  const shouldResetStateRef = useRef(null);
  // const lastConnectedTimeRef = useRef(null);
  const timeInBackgroundRef = useRef(0);

  const hasInitializedNavListener = useRef(false);
  const hasInitializedBoltzData = useRef(false);
  const hasInitializedNetworkMonitoring = useRef(null);

  const toggleDidGetToHomepage = useCallback(newInfo => {
    setDidGetToHomePage(newInfo);
  }, []);

  const toggleMinMaxLiquidSwapAmounts = useCallback(newInfo => {
    setMinMaxLiquidSwapAmounts(prev => ({ ...prev, ...newInfo }));
  }, []);

  useEffect(() => {
    const handleWindowSizeChange = newDimensions => {
      console.log('Window size state changed to:', newDimensions.screen);
      setScreenDimensions(newDimensions.screen);
    };

    Dimensions.addEventListener('change', handleWindowSizeChange);
  }, []);

  useEffect(() => {
    const handleAppStateChange = nextAppState => {
      console.log('App state changed to:', nextAppState);
      if (nextAppState === 'background') {
        shouldResetStateRef.current = false;
        timeInBackgroundRef.current = Date.now();
      } else if (nextAppState === 'active') {
        const timeInBackground = timeInBackgroundRef.current
          ? Date.now() - timeInBackgroundRef.current
          : 0;
        // const timeSinceLastReset = lastConnectedTimeRef.current
        //   ? Date.now() - lastConnectedTimeRef.current
        //   : 0;

        if (
          timeInBackground > BACKGROUND_THRESHOLD_MS
          //  ||
          // (timeSinceLastReset > FORCE_RESET_SPAARK_STATE_MS &&
          //   timeInBackground > 45 * 1000)
        ) {
          setTimeout(() => {
            toggleDidGetToHomepage(false);
          }, 100);

          shouldResetStateRef.current = true;
          // lastConnectedTimeRef.current = null;
        } else {
          shouldResetStateRef.current = false;
        }
        timeInBackgroundRef.current = null;
      }

      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      setIsAppFocused(true);
      return;
    }

    const handleFocus = () => {
      console.log('Android AppState focus event');
      setIsAppFocused(true);
    };

    const handleBlur = () => {
      console.log('Android AppState blur event');
      setIsAppFocused(false);
    };

    const focusListener = AppState.addEventListener('focus', handleFocus);
    const blurListener = AppState.addEventListener('blur', handleBlur);

    return () => {
      focusListener?.remove();
      blurListener?.remove();
    };
  }, []);

  useEffect(() => {
    if (!__DEV__) return;
    if (appState !== 'active' || hasInitializedNavListener.current) {
      if (appState !== 'active' && !hasInitializedNavListener.current) {
        console.log('Skipping navigation listener setup - app not active');
      }
      return;
    }

    console.log('Setting up navigation listener - first time app is active');
    hasInitializedNavListener.current = true;

    const unsubscribe = navigationRef.addListener('state', () => {
      console.log(
        'Current navigation stack',
        navigationRef.getRootState().routes,
      );
    });

    return () => {
      unsubscribe();
    };
  }, [appState]);

  useEffect(() => {
    if (appState !== 'active' || hasInitializedBoltzData.current) {
      if (appState !== 'active' && !hasInitializedBoltzData.current) {
        console.log('Skipping Boltz API calls - app not active');
      }
      return;
    }

    console.log('Making Boltz API calls - first time app is active');
    hasInitializedBoltzData.current = true;

    (async () => {
      try {
        const [
          // submarineSwapStats,
          reverseSwapStats,
        ] = await Promise.all([
          // getBoltzSwapPairInformation('submarine'),
          getBoltzSwapPairInformation('reverse'),
        ]);

        const liquidReverse = reverseSwapStats.BTC['L-BTC'];
        const min = liquidReverse?.limits?.minimal || 1000;
        const max = liquidReverse?.limits?.maximal || 25000000;

        setMinMaxLiquidSwapAmounts(prev => ({
          // reverseSwapStats: liquidReverse,
          // submarineSwapStats: submarineSwapStats['L-BTC'].BTC,
          ...prev,
          min,
          max,
          rsk: {
            ...prev.rsk,
            submarine: reverseSwapStats.BTC.RBTC,
            // reverse: submarineSwapStats.RBTC.BTC,
            min: reverseSwapStats.BTC.RBTC.limits.minimal,
            max: reverseSwapStats.BTC.RBTC.limits.maximal,
          },
        }));
      } catch (error) {
        console.error('Error fetching Boltz swap information:', error);
      }
    })();
  }, [appState]);

  useEffect(() => {
    if (appState !== 'active') {
      console.log('Stopping network monitoring - app not active');
      if (hasInitializedNetworkMonitoring.current) {
        clearInterval(hasInitializedNetworkMonitoring.current);
        hasInitializedNetworkMonitoring.current = null;
      }
      return;
    }

    console.log('Setting up network monitoring');

    const checkNetworkState = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        console.log(networkState, 'network state in startup function');
        setIsConnectedToTheInternet(networkState.isInternetReachable);
      } catch (error) {
        console.error('Error checking network state:', error);
      }
    };

    checkNetworkState();

    hasInitializedNetworkMonitoring.current = setInterval(
      checkNetworkState,
      5000,
    );

    return () => {
      console.log('Cleaning up network monitoring');
      if (hasInitializedNetworkMonitoring.current) {
        clearInterval(hasInitializedNetworkMonitoring.current);
        hasInitializedNetworkMonitoring.current = null;
      }
    };
  }, [appState]);

  console.log(minMaxLiquidSwapAmounts, 'min max liquid swap amounts');

  const contextValue = useMemo(
    () => ({
      minMaxLiquidSwapAmounts,
      toggleMinMaxLiquidSwapAmounts,
      isConnectedToTheInternet,
      didGetToHomepage,
      toggleDidGetToHomepage,
      appState,
      screenDimensions,
      shouldResetStateRef,
      isAppFocused,
      // lastConnectedTimeRef,
    }),
    [
      minMaxLiquidSwapAmounts,
      toggleMinMaxLiquidSwapAmounts,
      isConnectedToTheInternet,
      didGetToHomepage,
      toggleDidGetToHomepage,
      appState,
      screenDimensions,
      shouldResetStateRef,
      isAppFocused,
      // lastConnectedTimeRef,
    ],
  );

  return (
    <AppStatusManager.Provider value={contextValue}>
      {children}
    </AppStatusManager.Provider>
  );
};

function useAppStatus() {
  const context = useContext(AppStatusManager);
  if (!context) {
    throw new Error('useAppStatus must be used within a AppStatusProvider');
  }
  return context;
}

export { AppStatusManager, AppStatusProvider, useAppStatus };
