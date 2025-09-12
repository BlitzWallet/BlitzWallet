import {useNavigation} from '@react-navigation/native';
import {useEffect, useRef} from 'react';
import {useAppStatus} from './appStatus';
// import {useGlobaleCash} from './eCash';
import {crashlyticsLogReport} from '../app/functions/crashlyticsLogs';
import {useSparkWallet} from './sparkContext';
import {useRootstockProvider} from './rootstockSwapContext';
import i18next from 'i18next';

// export function EcashNavigationListener() {
//   const navigation = useNavigation();
//   const {didGetToHomepage} = useAppStatus();
//   const {pendingNavigation, setPendingNavigation} = useGlobaleCash();
//   const isNavigating = useRef(false); // Use a ref for local state

//   useEffect(() => {
//     if (!pendingNavigation) return;
//     if (!didGetToHomepage) {
//       setPendingNavigation(null);
//       return;
//     }
//     if (isNavigating.current) return;
//     crashlyticsLogReport(
//       `Navigating to confirm tx page in ecash listener with: ${JSON.stringify(
//         pendingNavigation,
//       )}`,
//     );
//     isNavigating.current = true;
//     requestAnimationFrame(() => {
//       requestAnimationFrame(() => {
//         navigation.reset(pendingNavigation);
//         isNavigating.current = false;
//         console.log('cleaning up navigation');
//       });
//     });
//     navigation.reset(pendingNavigation);

//     setPendingNavigation(null);
//   }, [pendingNavigation, didGetToHomepage]);

//   return null;
// }
export function RootstockNavigationListener() {
  const navigation = useNavigation();
  const {didGetToHomepage} = useAppStatus();
  const {pendingNavigation, setPendingNavigation} = useRootstockProvider();
  const isNavigating = useRef(false); // Use a ref for local state

  useEffect(() => {
    if (!pendingNavigation) return;
    if (!didGetToHomepage) {
      setPendingNavigation(null);
      return;
    }
    if (isNavigating.current) return;
    crashlyticsLogReport(
      `Navigating to confirm tx page in spark listener with: ${JSON.stringify(
        pendingNavigation,
      )}`,
    );
    isNavigating.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        navigation.navigate('ErrorScreen', {
          errorMessage: i18next.t('errormessages.receivedRootstock'),
        });
        isNavigating.current = false;
        console.log('cleaning up navigation');
      });
    });

    setPendingNavigation(null);
  }, [pendingNavigation, didGetToHomepage]);

  return null;
}

export function LiquidNavigationListener() {
  const navigation = useNavigation();
  const {didGetToHomepage} = useAppStatus();
  const {pendingLiquidPayment, setPendingLiquidPayment} = useSparkWallet();
  const isNavigating = useRef(false); // Use a ref for local state

  useEffect(() => {
    if (!pendingLiquidPayment) return;
    if (!didGetToHomepage) {
      setPendingLiquidPayment(null);
      return;
    }
    if (isNavigating.current) return;
    crashlyticsLogReport(
      `Navigating to confirm tx page in spark listener with: ${JSON.stringify(
        pendingLiquidPayment,
      )}`,
    );
    isNavigating.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        navigation.navigate('ErrorScreen', {
          errorMessage: i18next.t('errormessages.receivedLiquid'),
        });
        isNavigating.current = false;
        console.log('cleaning up navigation');
      });
    });

    setPendingLiquidPayment(null);
  }, [pendingLiquidPayment, didGetToHomepage]);

  return null;
}

export function SparkNavigationListener() {
  const navigation = useNavigation();
  const {didGetToHomepage} = useAppStatus();
  const {pendingNavigation, setPendingNavigation} = useSparkWallet();
  const isNavigating = useRef(false); // Use a ref for local state

  useEffect(() => {
    if (!pendingNavigation) return;
    if (!didGetToHomepage) {
      setPendingNavigation(null);
      return;
    }
    if (isNavigating.current) return;
    crashlyticsLogReport(
      `Navigating to confirm tx page in spark listener with: ${JSON.stringify(
        pendingNavigation,
      )}`,
    );
    isNavigating.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        navigation.reset(pendingNavigation);
        isNavigating.current = false;
        console.log('cleaning up navigation');
      });
    });

    setPendingNavigation(null);
  }, [pendingNavigation, didGetToHomepage]);

  return null;
}
