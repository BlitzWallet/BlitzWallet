import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {AppState} from 'react-native';
import {getBoltzSwapPairInformation} from '../app/functions/boltz/boltzSwapInfo';
import * as Network from 'expo-network';
import {navigationRef} from '../navigation/navigationService';

// Initiate context
const AppStatusManager = createContext(null);

const AppStatusProvider = ({children}) => {
  const [minMaxLiquidSwapAmounts, setMinMaxLiquidSwapAmounts] = useState({
    min: 1000,
    max: 25000000,
    rsk: {
      min: 3000,
      max: 10000000,
    },
  });
  const [isConnectedToTheInternet, setIsConnectedToTheInternet] =
    useState(null);
  const [didGetToHomepage, setDidGetToHomePage] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  const hasInitializedNavListener = useRef(false);
  const hasInitializedBoltzData = useRef(false);
  const hasInitializedNetworkMonitoring = useRef(false);

  const toggleDidGetToHomepage = useCallback(newInfo => {
    setDidGetToHomePage(newInfo);
  }, []);

  const toggleMinMaxLiquidSwapAmounts = useCallback(newInfo => {
    setMinMaxLiquidSwapAmounts(prev => ({...prev, ...newInfo}));
  }, []);

  useEffect(() => {
    const handleAppStateChange = nextAppState => {
      console.log('App state changed to:', nextAppState);
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
    if (appState !== 'active' || hasInitializedNavListener.current) {
      if (appState !== 'active') {
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
      if (appState !== 'active') {
        console.log('Skipping Boltz API calls - app not active');
      }
      return;
    }

    console.log('Making Boltz API calls - first time app is active');
    hasInitializedBoltzData.current = true;

    (async () => {
      try {
        const [submarineSwapStats, reverseSwapStats] = await Promise.all([
          getBoltzSwapPairInformation('submarine'),
          getBoltzSwapPairInformation('reverse'),
        ]);

        const liquidReverse = reverseSwapStats.BTC['L-BTC'];
        const min = liquidReverse?.limits?.minimal || 1000;
        const max = liquidReverse?.limits?.maximal || 25000000;

        toggleMinMaxLiquidSwapAmounts({
          reverseSwapStats: liquidReverse,
          submarineSwapStats: submarineSwapStats['L-BTC'].BTC,
          min,
          max,
          rsk: {
            submarine: reverseSwapStats.BTC.RBTC,
            reverse: submarineSwapStats.RBTC.BTC,
            min: reverseSwapStats.BTC.RBTC.limits.minimal,
            max: reverseSwapStats.BTC.RBTC.limits.maximal,
          },
        });
      } catch (error) {
        console.error('Error fetching Boltz swap information:', error);
      }
    })();
  }, [appState, toggleMinMaxLiquidSwapAmounts]);

  useEffect(() => {
    if (appState !== 'active' || hasInitializedNetworkMonitoring.current) {
      if (appState !== 'active') {
        console.log('Skipping network monitoring setup - app not active');
      }
      return;
    }

    console.log('Setting up network monitoring - first time app is active');
    hasInitializedNetworkMonitoring.current = true;

    Network.addNetworkStateListener(
      ({type, isConnected, isInternetReachable}) => {
        console.log(
          `Network type: ${type}, Connected: ${isConnected}, Internet Reachable: ${isInternetReachable}`,
        );
        setIsConnectedToTheInternet(isConnected);
      },
    );

    const checkNetworkState = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        console.log(networkState, 'network state in startup function');
        setIsConnectedToTheInternet(networkState.isConnected);
      } catch (error) {
        console.error('Error checking network state:', error);
      }
    };

    checkNetworkState();
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
    }),
    [
      minMaxLiquidSwapAmounts,
      toggleMinMaxLiquidSwapAmounts,
      isConnectedToTheInternet,
      didGetToHomepage,
      toggleDidGetToHomepage,
      appState,
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

export {AppStatusManager, AppStatusProvider, useAppStatus};
