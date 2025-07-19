import {
  createContext,
  useState,
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {useAppStatus} from './appStatus';
import fetchBackend from '../db/handleBackend';
import {useKeysContext} from './keys';

// Initiate context
const ServerTimeManager = createContext(null);

const GlobalServerTimeProvider = ({children}) => {
  const {didGetToHomepage} = useAppStatus();
  const {contactsPrivateKey, publicKey} = useKeysContext();

  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const retryTimeoutRef = useRef(null);

  const syncServerTime = useCallback(
    async (isRetry = false) => {
      if (isSyncing) return;

      setIsSyncing(true);

      try {
        const clientRequestTime = Date.now();

        const response = await fetchBackend(
          'serverTime',
          '',
          contactsPrivateKey,
          publicKey,
        );

        const clientReceiveTime = Date.now();

        if (!response) {
          throw new Error('No response from server');
        }

        const networkLatency = (clientReceiveTime - clientRequestTime) / 2;
        const adjustedClientTime = clientRequestTime + networkLatency;

        let serverTimeMs;
        if (typeof response === 'object' && response.timestamp) {
          serverTimeMs = response.timestamp;
        } else if (typeof response === 'string') {
          serverTimeMs = new Date(response).getTime();
        } else {
          serverTimeMs = Number(response);
        }

        const offset = serverTimeMs - adjustedClientTime;

        setServerTimeOffset(offset);

        setIsInitialized(true);
      } catch (error) {
        console.error('❌ Failed to sync server time:', error);

        if (!isRetry && !isInitialized) {
          // Only retry once for initial sync
          console.log('🔄 Retrying server time sync in 20 seconds...');
          retryTimeoutRef.current = setTimeout(() => {
            syncServerTime(true);
          }, 30000);
        } else if (!isInitialized) {
          // Complete failure - use device time
          setServerTimeOffset(0);
          setIsInitialized(true);
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [contactsPrivateKey, publicKey, isSyncing, isInitialized],
  );

  const getServerTime = useCallback(() => {
    if (!isInitialized) {
      console.warn('⚠️  Server time not initialized, using device time');
      return Date.now();
    }

    return Date.now() + serverTimeOffset;
  }, [serverTimeOffset, isInitialized]);

  useEffect(() => {
    if (!didGetToHomepage || isInitialized || isSyncing) return;

    console.log('🚀 Initializing server time sync...');
    syncServerTime();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [didGetToHomepage, isInitialized, isSyncing, syncServerTime]);

  const contextValue = useMemo(() => {
    return {
      getServerTime,

      isInitialized,
      isSyncing,
      serverTimeOffset,

      isUsingServerTime: isInitialized && serverTimeOffset !== 0,
    };
  }, [getServerTime, isInitialized, isSyncing, serverTimeOffset]);

  return (
    <ServerTimeManager.Provider value={contextValue}>
      {children}
    </ServerTimeManager.Provider>
  );
};

function useServerTime() {
  const context = useContext(ServerTimeManager);
  if (!context) {
    throw new Error(
      'useServerTime must be used within a GlobalServerTimeProvider',
    );
  }
  return context;
}

function useServerTimeOnly() {
  const {getServerTime} = useServerTime();
  return getServerTime;
}

export {
  ServerTimeManager,
  GlobalServerTimeProvider,
  useServerTime,
  useServerTimeOnly,
};
