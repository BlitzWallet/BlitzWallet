import {
  createContext,
  useState,
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import fetchBackend from '../db/handleBackend';
import { useKeysContext } from './keys';
import { getLocalStorageItem, setLocalStorageItem } from '../app/functions';
import { isMoreThanADayOld } from '../app/functions/rotateAddressDateChecker';

// Initiate context
const ServerTimeManager = createContext(null);

const GlobalServerTimeProvider = ({ children }) => {
  const { contactsPrivateKey, publicKey } = useKeysContext();

  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const retryTimeoutRef = useRef(null);
  const hasAttemptedSyncRef = useRef(false);

  const syncServerTime = useCallback(
    async (isRetry = false) => {
      if (isSyncing) return;

      setIsSyncing(true);

      try {
        const clientRequestTime = Date.now();
        const savedServerTimeOffset = JSON.parse(
          await getLocalStorageItem('savedServerTimeOffset'),
        );

        if (
          savedServerTimeOffset?.offset !== undefined &&
          !isMoreThanADayOld(savedServerTimeOffset.lastRotated)
        ) {
          console.log(
            'Using cached server time offset',
            savedServerTimeOffset.offset,
          );
          setServerTimeOffset(savedServerTimeOffset.offset);
          setIsInitialized(true);
          setIsSyncing(false);
          return;
        }

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
        await setLocalStorageItem(
          'savedServerTimeOffset',
          JSON.stringify({ offset, lastRotated: Date.now() }),
        );

        setIsInitialized(true);
        setIsSyncing(false);
      } catch (error) {
        console.error('Failed to sync server time:', error);

        if (!isRetry) {
          console.log('Retrying server time sync in 30 seconds...');
          retryTimeoutRef.current = setTimeout(() => {
            syncServerTime(true);
          }, 30000);
        } else {
          console.warn('Server time sync failed, falling back to device time');
          setServerTimeOffset(0);
          setIsInitialized(true);
        }

        setIsSyncing(false);
      }
    },
    [contactsPrivateKey, publicKey],
  );

  const getServerTime = useCallback(() => {
    if (!isInitialized) {
      console.warn('Server time not initialized, using device time');
      return Date.now();
    }

    return Date.now() + serverTimeOffset;
  }, [serverTimeOffset, isInitialized]);

  useEffect(() => {
    hasAttemptedSyncRef.current = false;
    setIsInitialized(false);
  }, [contactsPrivateKey, publicKey]);

  useEffect(() => {
    if (!contactsPrivateKey || !publicKey) return;
    if (hasAttemptedSyncRef.current) return;

    console.log('Initializing server time sync...');
    hasAttemptedSyncRef.current = true;
    syncServerTime();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [contactsPrivateKey, publicKey, syncServerTime]);

  const contextValue = useMemo(
    () => ({
      getServerTime,
      isInitialized,
      isSyncing,
      serverTimeOffset,
      isUsingServerTime: isInitialized && serverTimeOffset !== 0,
    }),
    [getServerTime, isInitialized, isSyncing, serverTimeOffset],
  );

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
  const { getServerTime } = useServerTime();
  return getServerTime;
}

export {
  ServerTimeManager,
  GlobalServerTimeProvider,
  useServerTime,
  useServerTimeOnly,
};
