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
import { firebaseAuth } from '../db/initializeFirebase';

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
          isEnabled: masterInfoObject.pushNotifications.enabledServices?.NWC,
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
