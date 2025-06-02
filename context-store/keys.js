import {getPublicKey} from 'nostr-tools';
import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
// Initiate context
const KeysContextManager = createContext(null);

const KeysContextProvider = ({children}) => {
  const [contactsPrivateKey, setContactsPrivateKey] = useState('');
  const publicKey = useMemo(
    () => (contactsPrivateKey ? getPublicKey(contactsPrivateKey) : null),
    [contactsPrivateKey],
  );
  const [accountMnemoinc, setAccountMnemonic] = useState('');

  const toggleContactsPrivateKey = useCallback(newKey => {
    setContactsPrivateKey(newKey);
  }, []);

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

export {KeysContextManager, KeysContextProvider, useKeysContext};
