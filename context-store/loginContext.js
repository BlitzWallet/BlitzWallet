import { createContext, useState, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { loadLoginState } from '../app/functions/login/loadLoginState';

const LoginContextManager = createContext(null);

const LoginProvider = ({ children }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loginRoute, setLoginRoute] = useState(null);
  const [loginState, setLoginState] = useState(null);

  const mountedRef = useRef(true);
  const loadStartedRef = useRef(false);
  const loadCounterRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;

    const thisLoad = ++loadCounterRef.current;

    // loadLoginState is non-rejecting by contract (migrations are best-effort).
    loadLoginState().then(result => {
      if (!mountedRef.current) return;
      // Always mark loaded on the initial mount path so the splash gate unblocks,
      // even if a concurrent refresh already wrote fresher data.
      setIsLoaded(true);
      if (thisLoad !== loadCounterRef.current) return;
      setLoginRoute(result.loginRoute);
      setLoginState(result.loginState);
    });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshLoginState = useCallback(async () => {
    const thisLoad = ++loadCounterRef.current;
    const result = await loadLoginState();
    if (!mountedRef.current || thisLoad !== loadCounterRef.current) return;
    setLoginRoute(result.loginRoute);
    setLoginState(result.loginState);
  }, []);

  const contextValue = useMemo(
    () => ({ isLoaded, loginRoute, loginState, refreshLoginState }),
    [isLoaded, loginRoute, loginState, refreshLoginState],
  );

  return (
    <LoginContextManager.Provider value={contextValue}>
      {children}
    </LoginContextManager.Provider>
  );
};

function useLoginContext() {
  const context = useContext(LoginContextManager);
  if (!context) {
    throw new Error('useLoginContext must be used within a LoginProvider');
  }
  return context;
}

export { LoginContextManager, LoginProvider, useLoginContext };
