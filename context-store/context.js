import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useTranslation } from 'react-i18next';
import { sendDataToDB } from '../db/interactionManager';
import { useKeysContext } from './keys';
import { addDataToCollection, getDataFromCollection } from '../db';
import { splitAndStoreNWCData } from '../app/functions/nwc';
import { NWC_NATIVE_HANDLER_VERSION } from '../app/functions/nwc/sharedStorage';
import { firebaseAuth } from '../db/initializeFirebase';
import { useAppStatus } from './appStatus';
import { Platform } from 'react-native';

// Initiate context
const GlobalContextManger = createContext(null);

const GlobalContextProvider = ({ children }) => {
  const { publicKey } = useKeysContext();

  const [masterInfoObject, setMasterInfoObject] = useState({});

  const [preloadedUserData, setPreLoadedUserData] = useState({
    isLoading: true,
    data: null,
  });

  const { i18n } = useTranslation();
  const { appState, didGetToHomepage } = useAppStatus();

  const toggleNWCInformation = useCallback(
    async newData => {
      // Allways add push notification data if it doesn't exist in new Data
      if (
        masterInfoObject?.NWC?.pushNotifications &&
        !newData.pushNotifications
      ) {
        newData.pushNotifications = {
          hash: masterInfoObject.pushNotifications.hash,
          platform: masterInfoObject.pushNotifications.platform,
          key: masterInfoObject.pushNotifications.key,
          isEnabled: !!(
            masterInfoObject.pushNotifications.isEnabled &&
            masterInfoObject.pushNotifications.enabledServices?.NWC
          ),
        };
      }

      // Tells the backend this app handles NWC pushes natively (iOS NSE),
      // so it can switch this device to the native push format.
      if (newData.pushNotifications && Platform.OS !== 'web') {
        newData.pushNotifications = {
          ...newData.pushNotifications,
          nativeHandler: NWC_NATIVE_HANDLER_VERSION,
        };
      }

      setMasterInfoObject(prev => ({
        ...prev,
        NWC: {
          ...prev.NWC,
          ...newData,
        },
      }));

      splitAndStoreNWCData({ ...masterInfoObject?.NWC, ...newData });

      let formattedNewData = newData;
      if (newData.accounts) {
        formattedNewData = {
          ...newData,
          accounts: Object.entries(newData.accounts).map(([key, value]) => ({
            [key]: {
              permissions: value.permissions,
              budgetSettings: value.budgetRenewalSettings,
            },
          })),
        };
      }

      await addDataToCollection(formattedNewData, 'NWC', publicKey);
    },
    [publicKey, masterInfoObject?.NWC],
  );
  const toggleMasterInfoObject = useCallback(
    async (newData, shouldSendToDb = true) => {
      if (newData.userSelectedLanguage) {
        await i18n.changeLanguage(newData.userSelectedLanguage);
      }

      setMasterInfoObject(prev => ({ ...prev, ...newData }));
      if (!shouldSendToDb) return;
      return await sendDataToDB(newData, publicKey);
    },
    [i18n, publicKey],
  );

  // Single-entry accountsLnurl update. Unlike toggleMasterInfoObject (whose
  // callers build the registry from a render-time snapshot), this merges into
  // local state functionally and sends ONLY the one map entry to Firestore —
  // setDoc merge touches just that entry's leaves, so entries added, edited or
  // pruned by another device (or by the additive LNURL sync) in the meantime
  // are never resurrected or reverted by a stale whole-registry write.
  const updateAccountsLnurlEntry = useCallback(
    async (id, updates) => {
      setMasterInfoObject(prev => ({
        ...prev,
        accountsLnurl: {
          ...prev.accountsLnurl,
          [id]: { ...prev.accountsLnurl?.[id], ...updates },
        },
      }));
      // Spread the known entry so a pruned/never-synced entry is recreated
      // whole instead of as a partial { receiveCurrency } shell. uuid and
      // identityPubKey are immutable per entry, so snapshot staleness is safe.
      const entry = { ...masterInfoObject.accountsLnurl?.[id], ...updates };
      return await sendDataToDB({ accountsLnurl: { [id]: entry } }, publicKey);
    },
    [masterInfoObject.accountsLnurl, publicKey],
  );

  // Native NWC handlers: on every foreground, refresh their config snapshot
  // (strings follow the current language), advertise support to the backend
  // once, and run any request they handed off to JS.
  useEffect(() => {
    if (Platform.OS === 'web' || !didGetToHomepage || appState !== 'active')
      return;
    const nwc = masterInfoObject.NWC;
    if (!nwc?.accounts || !Object.keys(nwc.accounts).length) return;

    const {
      prepareNativeNWCHandler,
      drainNativeNWCHandoffs,
    } = require('../app/functions/nwc/backgroundNofifications');
    prepareNativeNWCHandler(nwc).then(ready => {
      if (
        ready &&
        nwc.pushNotifications &&
        nwc.pushNotifications.nativeHandler !== NWC_NATIVE_HANDLER_VERSION
      ) {
        toggleNWCInformation({ pushNotifications: nwc.pushNotifications });
      }
      drainNativeNWCHandoffs();
    });
  }, [didGetToHomepage, appState]);

  useEffect(() => {
    async function preloadUserData() {
      try {
        if (firebaseAuth.currentUser) {
          const collectionData = await getDataFromCollection(
            'blitzWalletUsers',
            firebaseAuth.currentUser.uid,
          );
          if (!collectionData) throw new Error('No data returened');
          setPreLoadedUserData({ isLoading: true, data: collectionData });
        } else throw new Error('No user logged in');
      } catch (err) {
        console.log('Error preloading user data');
        setPreLoadedUserData({ isLoading: false, data: null });
      }
    }
    preloadUserData();
  }, []);

  const contextValue = useMemo(
    () => ({
      toggleMasterInfoObject,
      updateAccountsLnurlEntry,
      setMasterInfoObject,
      masterInfoObject,
      toggleNWCInformation,
      preloadedUserData,
      setPreLoadedUserData,
    }),
    [
      toggleMasterInfoObject,
      updateAccountsLnurlEntry,
      masterInfoObject,
      setMasterInfoObject,
      toggleNWCInformation,
      preloadedUserData,
      setPreLoadedUserData,
    ],
  );

  return (
    <GlobalContextManger.Provider value={contextValue}>
      {children}
    </GlobalContextManger.Provider>
  );
};

function useGlobalContextProvider() {
  const context = useContext(GlobalContextManger);
  if (!context) {
    throw new Error(
      'useGlobalContextProvider must be used within a GlobalContextProvider',
    );
  }
  return context;
}

export { GlobalContextManger, GlobalContextProvider, useGlobalContextProvider };
