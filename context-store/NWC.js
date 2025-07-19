import {createContext, useState, useContext, useMemo} from 'react';

// Initiate context
const NostrWalletConnectManager = createContext(null);

const GlobalNostrWalletConnectProvider = ({children}) => {
  const [nwcWalletInfo, setNWCWalletInfo] = useState({
    balance: 0,
    transactions: [],
    identityPubKey: '',
    sparkAddress: '',
    didConnect: null,
  });

  const contextValue = useMemo(
    () => ({
      nwcWalletInfo,
      setNWCWalletInfo,
    }),
    [nwcWalletInfo, setNWCWalletInfo],
  );

  return (
    <NostrWalletConnectManager.Provider value={contextValue}>
      {children}
    </NostrWalletConnectManager.Provider>
  );
};

function useNostrWalletConnect() {
  const context = useContext(NostrWalletConnectManager);
  if (!context) {
    throw new Error(
      'useNostrWalletConnect must be used within a GlobalNostrWalletConnectProvider',
    );
  }
  return context;
}

export {
  NostrWalletConnectManager,
  GlobalNostrWalletConnectProvider,
  useNostrWalletConnect,
};
