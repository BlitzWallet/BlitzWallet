import {createContext, useContext, useEffect, useRef, useState} from 'react';
import {
  PaymentDetailsVariant,
  PaymentType,
  SdkEventVariant,
} from '@breeztech/react-native-breez-sdk-liquid';
import startLiquidUpdateInterval from '../app/functions/liquidBackupUpdate';
import {AppState} from 'react-native';
import {useNodeContext} from './nodeContext';
import {useAppStatus} from './appStatus';
import {BLOCKED_NAVIGATION_PAYMENT_CODES} from '../app/constants';
import {shouldBlockNavigation} from '../app/functions/sendBitcoin';

const LiquidEventContext = createContext(null);

// Create a context for the WebView ref
export function LiquidEventProvider({children}) {
  const {toggleLiquidNodeInformation, liquidNodeInformation} = useNodeContext();
  const {didGetToHomepage} = useAppStatus();
  const intervalId = useRef(null);
  const debounceTimer = useRef(null);
  const isWaitingForActiveRef = useRef(false);
  const backgroundNotificationEvent = useRef(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [liquidEvent, setLiquidEvent] = useState(null);
  const receivedPayments = useRef([]);
  // Add debug logging
  useEffect(() => {
    console.log('liquidEvent changed:', liquidEvent);
  }, [liquidEvent]);
  const debouncedStartInterval = intervalCount => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      if (intervalId.current) clearInterval(intervalId.current);
      intervalId.current = startLiquidUpdateInterval(
        toggleLiquidNodeInformation,
        intervalCount,
      );
    }, 2000);
  };

  const waitForActiveScreen = () => {
    const subscription = AppState.addEventListener('change', state => {
      console.log('RUNNINGIN WAIT FOR AVTIVE SCREEN', state);
      if (state === 'active' && backgroundNotificationEvent.current) {
        isWaitingForActiveRef.current = false;
        setPendingNavigation({
          routes: [
            {
              name: 'HomeAdmin',
              params: {screen: 'Home'},
            },
            {
              name: 'ConfirmTxPage',
              params: {
                for:
                  backgroundNotificationEvent.current.details.paymentType ===
                  PaymentType.SEND
                    ? 'paymentsucceed'
                    : 'invoicepaid',
                information: backgroundNotificationEvent.current?.details,
                formattingType: 'liquidNode',
              },
            },
          ],
        });
        backgroundNotificationEvent.current = null;
        subscription.remove();
        return true;
      }
    });
  };

  const shouldNavigate = event => {
    console.log('RUNNING IN SHOULD NAVIGATE', event.type);

    if (
      event.type === SdkEventVariant.PAYMENT_WAITING_CONFIRMATION ||
      event.type === SdkEventVariant.PAYMENT_PENDING
    ) {
      if (
        !event?.details?.txId ||
        receivedPayments.current.includes(event?.details?.txId)
      ) {
        return false;
      }
      receivedPayments.current.push(event?.details?.txId);

      if (
        event?.details?.details?.type === PaymentDetailsVariant.BITCOIN &&
        event?.details.paymentType === PaymentType.SEND
      )
        return false;
      console.log('CURRENT APP STATW', AppState.currentState);
      if (AppState.currentState == 'background') {
        if (!isWaitingForActiveRef.current) {
          isWaitingForActiveRef.current = true;
          backgroundNotificationEvent.current = event;
          waitForActiveScreen();
        }
        return false;
      }
      const description =
        event?.details?.details?.lnurlInfo?.lnurlPayComment ||
        event.details?.details?.description;
      console.log(
        shouldBlockNavigation(description),
        'NEW WAY',
        '_________',
        'OLD WAY',
        BLOCKED_NAVIGATION_PAYMENT_CODES.includes(
          event.details?.details?.description,
        ),
        'BLOCKING NAVIGATION LOGIC',
      );

      if (shouldBlockNavigation(description)) return false;
      return true;
    } else {
      return false;
    }
  };

  useEffect(() => {
    if (!liquidEvent) return;
    const response = shouldNavigate(liquidEvent);
    if (response) {
      console.log('SETTING PENDING NAVIGATION');
      setPendingNavigation({
        routes: [
          {
            name: 'HomeAdmin',
            params: {screen: 'Home'},
          },
          {
            name: 'ConfirmTxPage',
            params: {
              for:
                liquidEvent.details.paymentType === PaymentType.SEND
                  ? 'paymentsucceed'
                  : 'invoicepaid',
              information: liquidEvent?.details,
              formattingType: 'liquidNode',
            },
          },
        ],
      });
    }
  }, [liquidEvent]);

  const onLiquidBreezEvent = e => {
    console.log('Running in breez Liquid event in useContext', e);
    if (!e || typeof e !== 'object') {
      console.warn('Invalid event received in onLiquidBreezEvent');
      return;
    }

    setLiquidEvent(e);

    if (e.type !== SdkEventVariant.SYNCED) {
      debouncedStartInterval(
        e.type === SdkEventVariant.PAYMENT_SUCCEEDED ? 1 : 0,
      );
    }
  };

  useEffect(() => {
    if (!didGetToHomepage) return;
    if (liquidNodeInformation.userBalance) return;
    console.log('Makeing sure user balance is loaded');

    debouncedStartInterval(0);
  }, [didGetToHomepage]);

  return (
    <LiquidEventContext.Provider
      value={{
        onLiquidBreezEvent,
        pendingNavigation,
        setPendingNavigation, // Include this so we can clear it after navigation
      }}>
      {children}
    </LiquidEventContext.Provider>
  );
}
export const useLiquidEvent = () => {
  return useContext(LiquidEventContext); // Use the correct context
};
