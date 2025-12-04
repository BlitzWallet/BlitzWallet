import { getPublicKey } from 'nostr-tools';
import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { useAuthContext } from './authContext';
// Initiate context
const KeysContextManager = createContext(null);

const KeysContextProvider = ({ children }) => {
  const { authResetkey } = useAuthContext();
  const [contactsPrivateKey, setContactsPrivateKey] = useState('');
  const publicKey = useMemo(
    () => (contactsPrivateKey ? getPublicKey(contactsPrivateKey) : null),
    [contactsPrivateKey],
  );
  const [accountMnemoinc, setAccountMnemonic] = useState('');
  const isInitialRender = useRef(true);

  const toggleContactsPrivateKey = useCallback(newKey => {
    setContactsPrivateKey(newKey);
  }, []);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    setContactsPrivateKey('');
    setAccountMnemonic('');
  }, [authResetkey]);

  const contextValue = useMemo(
    () => ({
      contactsPrivateKey,
      publicKey,
      toggleContactsPrivateKey,
      accountMnemoinc,
      setAccountMnemonic,
    }),
    [
      contactsPrivateKey,
      publicKey,
      toggleContactsPrivateKey,
      accountMnemoinc,
      setAccountMnemonic,
    ],
  );

  return (
    <KeysContextManager.Provider value={contextValue}>
      {children}
    </KeysContextManager.Provider>
  );
};

function useKeysContext() {
  const context = useContext(KeysContextManager);
  if (!context) {
    throw new Error('useKeysContext must be used within a KeysContextProvider');
  }
  return context;
}

export { KeysContextManager, KeysContextProvider, useKeysContext };
