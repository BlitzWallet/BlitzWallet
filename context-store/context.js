import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {useTranslation} from 'react-i18next';
import {sendDataToDB} from '../db/interactionManager';
import {useKeysContext} from './keys';
import {addDataToCollection} from '../db';
import {splitAndStoreNWCData} from '../app/functions/nwc';

// Initiate context
const GlobalContextManger = createContext(null);

const GlobalContextProvider = ({children}) => {
  const {publicKey} = useKeysContext();

  const [masterInfoObject, setMasterInfoObject] = useState({});

  const {i18n} = useTranslation();

  const toggleNWCInformation = useCallback(
    async newData => {
      setMasterInfoObject(prev => ({
        ...prev,
        NWC: {
          ...prev.NWC,
          ...newData,
        },
      }));

      splitAndStoreNWCData({...masterInfoObject?.NWC, ...newData});

      let formattedNewData = newData;
      if (newData.accounts) {
        formattedNewData = {
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

      setMasterInfoObject(prev => ({...prev, ...newData}));
      if (!shouldSendToDb) return;
      await sendDataToDB(newData, publicKey);
    },
    [i18n, publicKey],
  );

  const contextValue = useMemo(
    () => ({
      toggleMasterInfoObject,
      setMasterInfoObject,
      masterInfoObject,
      toggleNWCInformation,
    }),
    [
      toggleMasterInfoObject,
      masterInfoObject,
      setMasterInfoObject,
      toggleNWCInformation,
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

export {GlobalContextManger, GlobalContextProvider, useGlobalContextProvider};
