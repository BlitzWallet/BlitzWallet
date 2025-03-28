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

// Initiate context
const GlobalContextManger = createContext(null);

const GlobalContextProvider = ({children}) => {
  const {contactsPrivateKey, publicKey} = useKeysContext();

  const [masterInfoObject, setMasterInfoObject] = useState({});

  const {i18n} = useTranslation();

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
    }),
    [toggleMasterInfoObject, masterInfoObject, setMasterInfoObject],
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
