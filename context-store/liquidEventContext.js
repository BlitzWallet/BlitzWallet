import {createContext, useCallback, useContext, useRef} from 'react';
import {SdkEventVariant} from '@breeztech/react-native-breez-sdk-liquid';
import startLiquidUpdateInterval from '../app/functions/liquidBackupUpdate';
import {useNodeContext} from './nodeContext';
const LiquidEventContext = createContext(null);

// Create a context for the WebView ref
export function LiquidEventProvider({children}) {
  const {toggleLiquidNodeInformation} = useNodeContext();
  const intervalId = useRef(null);
  const debounceTimer = useRef(null);

  const isInitialSync = useRef(true);
  const syncRunCounter = useRef(1);

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

  const onLiquidBreezEvent = useCallback(
    e => {
      console.log('Running in breez Liquid event in useContext', e);
      if (!e || typeof e !== 'object') {
        console.warn('Invalid event received in onLiquidBreezEvent');
        return;
      }

      if (e.type !== SdkEventVariant.SYNCED) {
        debouncedStartInterval(
          e.type === SdkEventVariant.PAYMENT_SUCCEEDED ? 1 : 0,
        );
      } else {
        console.log(
          `Running in sync else statment for liquiid on sync count:${syncRunCounter.current} and is initiail sync ${isInitialSync.current}`,
        );
        // if (syncRunCounter.current >= (isInitialSync.current ? 2 : 6)) {
        //   if (isInitialSync.current) isInitialSync.current = false;
        //   console.log('running debounce sync else statment for liquiid');
        //   debouncedStartInterval(0);
        //   syncRunCounter.current = 0;
        // }
        // syncRunCounter.current = syncRunCounter.current + 1;
      }
    },
    [syncRunCounter, isInitialSync],
  );

  return (
    <LiquidEventContext.Provider
      value={{
        onLiquidBreezEvent,
      }}>
      {children}
    </LiquidEventContext.Provider>
  );
}
export const useLiquidEvent = () => {
  return useContext(LiquidEventContext); // Use the correct context
};
