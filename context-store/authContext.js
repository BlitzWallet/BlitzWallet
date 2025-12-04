import { createContext, useState, useContext, useEffect, useMemo } from 'react';
import { navigationRef } from '../navigation/navigationService';
import { useAppStatus } from './appStatus';

// Initiate context
const AuthStatusManager = createContext(null);

const AuthStatusProvider = ({ children }) => {
  const { appState, shouldResetStateRef } = useAppStatus();
  const [authResetkey, setAuthResetKey] = useState(0);

  useEffect(() => {
    if (appState === 'active' && shouldResetStateRef.current) {
      setAuthResetKey(prev => prev + 1);
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: 'Splash' }],
      });
    }
  }, [appState]);

  const contextValue = useMemo(
    () => ({
      authResetkey,
    }),
    [authResetkey],
  );

  return (
    <AuthStatusManager.Provider value={contextValue}>
      {children}
    </AuthStatusManager.Provider>
  );
};

function useAuthContext() {
  const context = useContext(AuthStatusManager);
  if (!context) {
    throw new Error('useAuthContext must be used within a AuthContextProvider');
  }
  return context;
}

export { AuthStatusManager, AuthStatusProvider, useAuthContext };
