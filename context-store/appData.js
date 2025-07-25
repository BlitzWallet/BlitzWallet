import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {addDataToCollection} from '../db';
import {decryptMessage} from '../app/functions/messaging/encodingAndDecodingMessages';
import {useKeysContext} from './keys';

// Create a context for the WebView ref
const GlobalAppData = createContext(null);

export const GlobalAppDataProvider = ({children}) => {
  const {contactsPrivateKey, publicKey} = useKeysContext();

  const [globalAppDataInformation, setGlobalAppDatasInformation] = useState({});
  const [giftCardsList, setGiftCardsList] = useState([]);
  const [decodedChatGPT, setDecodedChatGPT] = useState(null);
  const [decodedMessages, setDecodedMessages] = useState(null);
  const [decodedVPNS, setDecodedVPNS] = useState(null);
  const [decodedGiftCards, setDecodedGiftCards] = useState(null);

  const toggleGlobalAppDataInformation = (newData, writeToDB) => {
    setGlobalAppDatasInformation(prev => {
      const newAppData = {...prev, ...newData};

      if (writeToDB) {
        addDataToCollection(
          {appData: newAppData},
          'blitzWalletUsers',
          publicKey,
        );
      }
      return newAppData;
    });
  };

  const toggleGiftCardsList = useCallback(giftCards => {
    setGiftCardsList(giftCards);
  }, []);

  const decryptData = (key, defaultValue) => {
    let data;
    if (key === 'chatGPT') {
      data = globalAppDataInformation[key]?.conversation;
    } else {
      data = globalAppDataInformation[key];
    }
    if (!publicKey || typeof data !== 'string') return defaultValue;
    return JSON.parse(decryptMessage(contactsPrivateKey, publicKey, data));
  };

  useEffect(() => {
    if (!publicKey || !contactsPrivateKey) return;
    const data = decryptData('chatGPT', []);
    setDecodedChatGPT({
      conversation: data,
      credits: globalAppDataInformation?.chatGPT?.credits || 0,
    });
  }, [globalAppDataInformation.chatGPT, publicKey, contactsPrivateKey]);

  useEffect(() => {
    if (!publicKey || !contactsPrivateKey) return;
    setDecodedMessages(decryptData('messagesApp', {received: [], sent: []}));
  }, [globalAppDataInformation.messagesApp, publicKey, contactsPrivateKey]);

  useEffect(() => {
    if (!publicKey || !contactsPrivateKey) return;
    setDecodedVPNS(decryptData('VPNplans', []));
  }, [globalAppDataInformation.VPNplans, publicKey, contactsPrivateKey]);

  useEffect(() => {
    if (!publicKey || !contactsPrivateKey) return;
    setDecodedGiftCards(decryptData('giftCards', {}));
  }, [globalAppDataInformation.giftCards, publicKey, contactsPrivateKey]);

  const contextValue = useMemo(
    () => ({
      decodedChatGPT,
      decodedMessages,
      decodedVPNS,
      decodedGiftCards,
      globalAppDataInformation,
      toggleGlobalAppDataInformation,
      giftCardsList,
      toggleGiftCardsList,
    }),
    [
      decodedChatGPT,
      decodedMessages,
      decodedVPNS,
      decodedGiftCards,
      globalAppDataInformation,
      giftCardsList,
    ],
  );

  return (
    <GlobalAppData.Provider value={contextValue}>
      {children}
    </GlobalAppData.Provider>
  );
};

export const useGlobalAppData = () => {
  return React.useContext(GlobalAppData);
};
