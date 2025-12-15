import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { addDataToCollection } from '../db';
import { decryptMessage } from '../app/functions/messaging/encodingAndDecodingMessages';
import { useKeysContext } from './keys';

// Create a context for the WebView ref
const GlobalAppData = createContext(null);

export const GlobalAppDataProvider = ({ children }) => {
  const { contactsPrivateKey, publicKey } = useKeysContext();

  const [globalAppDataInformation, setGlobalAppDatasInformation] = useState({});
  const [giftCardsList, setGiftCardsList] = useState([]);
  const [decodedChatGPT, setDecodedChatGPT] = useState(null);
  const [decodedMessages, setDecodedMessages] = useState(null);
  const [decodedVPNS, setDecodedVPNS] = useState(null);
  const [decodedGiftCards, setDecodedGiftCards] = useState(null);

  const toggleGlobalAppDataInformation = (newData, writeToDB) => {
    setGlobalAppDatasInformation(prev => {
      const newAppData = { ...prev, ...newData };

      if (writeToDB) {
        addDataToCollection(
          { appData: newAppData },
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
    try {
      let data;
      if (key === 'chatGPT') {
        data = globalAppDataInformation[key]?.conversation;
      } else {
        data = globalAppDataInformation[key];
      }
      if (!publicKey || typeof data !== 'string') return defaultValue;

      const decryptedString = decryptMessage(
        contactsPrivateKey,
        publicKey,
        data,
      );

      if (
        !decryptedString ||
        typeof decryptedString !== 'string' ||
        decryptedString.trim() === ''
      ) {
        console.warn(`Decryption returned invalid data for key: ${key}`);
        return defaultValue;
      }

      return JSON.parse(decryptedString);
    } catch (error) {
      console.error(`Error decrypting data for key "${key}":`, error.message);
      return defaultValue;
    }
  };

  useEffect(() => {
    if (!publicKey || !contactsPrivateKey) return;
    try {
      const data = decryptData('chatGPT', []);
      setDecodedChatGPT({
        conversation: data,
        credits: globalAppDataInformation?.chatGPT?.credits || 0,
      });
    } catch (error) {
      console.error('Error decoding ChatGPT data:', error);
      setDecodedChatGPT({
        conversation: [],
        credits: 0,
      });
    }
  }, [globalAppDataInformation.chatGPT, publicKey, contactsPrivateKey]);

  useEffect(() => {
    if (!publicKey || !contactsPrivateKey) return;
    try {
      setDecodedMessages(
        decryptData('messagesApp', { received: [], sent: [] }),
      );
    } catch (error) {
      console.error('Error decoding messages:', error);
      setDecodedMessages({ received: [], sent: [] });
    }
  }, [globalAppDataInformation.messagesApp, publicKey, contactsPrivateKey]);

  useEffect(() => {
    if (!publicKey || !contactsPrivateKey) return;
    try {
      setDecodedVPNS(decryptData('VPNplans', []));
    } catch (error) {
      console.error('Error decoding VPN plans:', error);
      setDecodedVPNS([]);
    }
  }, [globalAppDataInformation.VPNplans, publicKey, contactsPrivateKey]);

  useEffect(() => {
    if (!publicKey || !contactsPrivateKey) return;
    try {
      setDecodedGiftCards(decryptData('giftCards', {}));
    } catch (error) {
      console.error('Error decoding gift cards:', error);
      setDecodedGiftCards({});
    }
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
