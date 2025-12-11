import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { useAppStatus } from './appStatus';
import { crashlyticsLogReport } from '../app/functions/crashlyticsLogs';
import { useSparkWallet } from './sparkContext';
import { useRootstockProvider } from './rootstockSwapContext';
import i18next from 'i18next';
import { InteractionManager } from 'react-native';
import { useToast } from './toastManager';
import { useNodeContext } from './nodeContext';

export function RootstockNavigationListener() {
  const navigation = useNavigation();
  const { didGetToHomepage } = useAppStatus();
  const { pendingNavigation, setPendingNavigation } = useRootstockProvider();
  const isNavigating = useRef(false); // Use a ref for local state

  useEffect(() => {
    if (!pendingNavigation) return;
    if (!didGetToHomepage) {
      setPendingNavigation(null);
      return;
    }
    if (isNavigating.current) return;
    crashlyticsLogReport(`Navigating to confirm tx page in roostock listener`);
    isNavigating.current = true;

    setTimeout(() => {
      requestAnimationFrame(() => {
        navigation.navigate('ErrorScreen', {
          errorMessage: i18next.t('errormessages.receivedRootstock'),
        });
        isNavigating.current = false;
        console.log('cleaning up navigation for rootstock');
      });
    }, 100);

    setPendingNavigation(null);
  }, [pendingNavigation, didGetToHomepage]);

  return null;
}

export function LiquidNavigationListener() {
  const navigation = useNavigation();
  const { didGetToHomepage } = useAppStatus();
  const { pendingLiquidPayment, setPendingLiquidPayment } = useNodeContext();
  const isNavigating = useRef(false); // Use a ref for local state

  useEffect(() => {
    if (!pendingLiquidPayment) return;
    if (!didGetToHomepage) {
      setPendingLiquidPayment(null);
      return;
    }
    if (isNavigating.current) return;
    crashlyticsLogReport(`Navigating to confirm tx page in liquid listener `);
    isNavigating.current = true;

    setTimeout(() => {
      requestAnimationFrame(() => {
        navigation.navigate('ErrorScreen', {
          errorMessage: i18next.t('errormessages.receivedLiquid'),
        });
        isNavigating.current = false;
        console.log('cleaning up navigation for liquid');
      });
    }, 100);

    setPendingLiquidPayment(null);
  }, [pendingLiquidPayment, didGetToHomepage]);

  return null;
}

export function SparkNavigationListener() {
  const navigation = useNavigation();
  const { didGetToHomepage } = useAppStatus();
  const { pendingNavigation, setPendingNavigation } = useSparkWallet();
  const isNavigating = useRef(false); // Use a ref for local state
  const { showToast } = useToast();

  useEffect(() => {
    if (!pendingNavigation) return;
    if (!didGetToHomepage) {
      setPendingNavigation(null);
      return;
    }
    if (isNavigating.current) return;
    crashlyticsLogReport(`Navigating to confirm tx page in spark listener`);
    isNavigating.current = true;

    setTimeout(() => {
      requestAnimationFrame(() => {
        if (pendingNavigation.showFullAnimation) {
          navigation.reset({
            routes: [
              {
                name: 'HomeAdmin',
                params: { screen: 'Home' },
              },
              {
                name: 'ConfirmTxPage',
                params: {
                  for: 'invoicePaid',
                  transaction: pendingNavigation.tx,
                },
              },
            ],
          });
        } else {
          showToast({
            amount: pendingNavigation.amount,
            LRC20Token: pendingNavigation.LRC20Token,
            isLRC20Payment: pendingNavigation.isLRC20Payment,
            duration: 7000,
            type: 'confirmTx',
          });
        }
        console.log('cleaning up navigation for spark');
        isNavigating.current = false;
      });
    }, 100);

    setPendingNavigation(null);
  }, [pendingNavigation, didGetToHomepage]);

  return null;
}
