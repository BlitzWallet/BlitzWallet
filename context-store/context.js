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
          accountsLookup: Object.keys(newData.accounts),
        };
      }

      await addDataToCollection(formattedNewData, 'NWC', publicKey);
    },
    [publicKey, masterInfoObject?.NWC],
  );
  const toggleMasterInfoObject = useCallback(
    async (newData, shouldSendToDb = true) => {
      if (newData.userSelectedLanguage) {
        i18n.changeLanguage(newData.userSelectedLanguage);
      }

      setMasterInfoObject(prev => ({ ...prev, ...newData }));
      if (!shouldSendToDb) return;
      await sendDataToDB(newData, publicKey);
    },
    [i18n, publicKey],
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
      setMasterInfoObject,
      masterInfoObject,
      toggleNWCInformation,
      preloadedUserData,
      setPreLoadedUserData,
    }),
    [
      toggleMasterInfoObject,
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
