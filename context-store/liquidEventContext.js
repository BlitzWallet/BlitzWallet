import {createContext, useCallback, useContext, useEffect, useRef} from 'react';
import {SdkEventVariant} from '@breeztech/react-native-breez-sdk-liquid';
import startLiquidUpdateInterval from '../app/functions/liquidBackupUpdate';
import {useNodeContext} from './nodeContext';
import {useGlobalContextProvider} from './context';
import {useGlobalContacts} from './globalContacts';
import {
  getDateXDaysAgo,
  isMoreThan7DaysPast,
} from '../app/functions/rotateAddressDateChecker';
import {breezLiquidReceivePaymentWrapper} from '../app/functions/breezLiquid';
const LiquidEventContext = createContext(null);

// Create a context for the WebView ref
export function LiquidEventProvider({children}) {
  const {toggleLiquidNodeInformation, liquidNodeInformation} = useNodeContext();
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {toggleGlobalContactsInformation, globalContactsInformation} =
    useGlobalContacts();
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

  useEffect(() => {
    async function addLiquidAddressesToDB() {
      try {
        const addressResponse = await (masterInfoObject.offlineReceiveAddresses
          .addresses.length !== 7 ||
        isMoreThan7DaysPast(
          masterInfoObject.offlineReceiveAddresses.lastRotated,
        )
          ? breezLiquidReceivePaymentWrapper({
              paymentType: 'liquid',
            })
          : Promise.resolve(null));

        console.log(addressResponse, 'liquid address response');
        if (addressResponse) {
          const {destination, receiveFeesSat} = addressResponse;
          console.log('LIQUID DESTINATION ADDRESS', destination);
          console.log(destination);
          if (!globalContactsInformation.myProfile.receiveAddress) {
            // For legacy users and legacy functions
            toggleGlobalContactsInformation(
              {
                myProfile: {
                  ...globalContactsInformation.myProfile,
                  receiveAddress: destination,
                  lastRotated: getDateXDaysAgo(0),
                },
              },
              true,
            );
          }
          // Didn't sperate since it only cost one write so there is no reasy not to update
          toggleMasterInfoObject({
            posSettings: {
              ...masterInfoObject.posSettings,
              receiveAddress: destination,
              lastRotated: getDateXDaysAgo(0),
            },
            offlineReceiveAddresses: {
              addresses: [
                destination,
                ...masterInfoObject.offlineReceiveAddresses.addresses.slice(
                  0,
                  6,
                ),
              ],
              lastRotated: new Date().getTime(),
            },
          });
        }
      } catch (err) {
        console.log('Error adding liquid address to db', err);
      }
    }
    if (!liquidNodeInformation.didConnectToNode) return;
    console.log('Running add liquid address to db');
    addLiquidAddressesToDB();
  }, [liquidNodeInformation.didConnectToNode]);

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
