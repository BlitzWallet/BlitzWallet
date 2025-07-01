import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import {
  addEventListener,
  removeEventListener,
  SdkEventVariant,
} from '@breeztech/react-native-breez-sdk-liquid';
import startLiquidUpdateInterval from '../app/functions/liquidBackupUpdate';
import {useNodeContext} from './nodeContext';

const LiquidEventContext = createContext(null);

const DEFAULT_EVENT_LIMIT = 15;
const DEBOUNCE_DELAY = 2000;
const REQUIRED_SYNC_COUNT = 2;

// Create a context for the WebView ref
export function LiquidEventProvider({children}) {
  const {toggleLiquidNodeInformation} = useNodeContext();

  const liquidEventRunCounter = useRef(0);
  const numberOfLiquidEvents = useRef(DEFAULT_EVENT_LIMIT);
  const liquidEventListenerId = useRef(null);
  const intervalId = useRef(null);
  const debounceTimer = useRef(null);
  const syncRunCounter = useRef(0);

  const cleanup = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (intervalId.current) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }
    if (liquidEventListenerId.current) {
      removeEventListener(liquidEventListenerId.current);
      liquidEventListenerId.current = null;
    }
  }, []);

  const debouncedStartInterval = useCallback(
    intervalCount => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        if (intervalId.current) {
          clearInterval(intervalId.current);
        }
        intervalId.current = startLiquidUpdateInterval(
          toggleLiquidNodeInformation,
          intervalCount,
        );
      }, DEBOUNCE_DELAY);
    },
    [toggleLiquidNodeInformation],
  );

  const onLiquidBreezEvent = useCallback(
    e => {
      if (!e || typeof e !== 'object') {
        console.warn('Invalid event received in onLiquidBreezEvent');
        return;
      }

      liquidEventRunCounter.current += 1;
      syncRunCounter.current += 1;

      console.log('Running in breez Liquid event in useContext', e);

      if (liquidEventRunCounter.current >= numberOfLiquidEvents.current) {
        removeEventListener(liquidEventListenerId.current);
        liquidEventListenerId.current = null;
      }

      const isSyncEvent =
        e.type === SdkEventVariant.SYNCED ||
        e.type === SdkEventVariant.DATA_SYNCED;
      const isPaymentSuccess = e.type === SdkEventVariant.PAYMENT_SUCCEEDED;

      if (!isSyncEvent) {
        debouncedStartInterval(isPaymentSuccess ? 1 : 0);
      } else if (syncRunCounter.current >= REQUIRED_SYNC_COUNT) {
        console.log(
          `Running in sync else statement for liquid on sync count: ${syncRunCounter.current}`,
        );
        syncRunCounter.current = 0;
        console.log('running debounce sync else statement for liquid');
        debouncedStartInterval(0);
      }
    },
    [debouncedStartInterval],
  );

  const startLiquidEventListener = useCallback(
    async (numberOfAttempts = DEFAULT_EVENT_LIMIT) => {
      try {
        if (liquidEventListenerId.current) {
          liquidEventRunCounter.current = 0;
          if (numberOfAttempts < numberOfLiquidEvents.current) return;
          numberOfLiquidEvents.current = numberOfAttempts;
          return;
        }

        numberOfLiquidEvents.current = numberOfAttempts;
        liquidEventListenerId.current = await addEventListener(
          onLiquidBreezEvent,
        );
      } catch (error) {
        console.error('Failed to start liquid event listener:', error);
      }
    },
    [onLiquidBreezEvent],
  );

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const contextValue = useMemo(
    () => ({
      startLiquidEventListener,
    }),
    [startLiquidEventListener],
  );
  return (
    <LiquidEventContext.Provider value={contextValue}>
      {children}
    </LiquidEventContext.Provider>
  );
}
export const useLiquidEvent = () => {
  return useContext(LiquidEventContext); // Use the correct context
};
