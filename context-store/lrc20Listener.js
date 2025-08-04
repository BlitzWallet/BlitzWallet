import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import {getSparkBalance} from '../app/functions/spark';
import sha256Hash from '../app/functions/hash';

const LRC20EventContext = createContext(null);
const DEFAULT_EVENT_LIMIT = 15;
const POLLING_INTERVAL_MS = 12000;

export function LRC20EventProvider({children}) {
  const maxAttempts = useRef(DEFAULT_EVENT_LIMIT);
  const currentAttempts = useRef(0);
  const intervalId = useRef(null);
  const prevData = useRef(null);

  const cleanup = useCallback(() => {
    if (intervalId.current) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }

    // Reset counters
    currentAttempts.current = 0;
  }, []);

  const startLrc20EventListener = useCallback(
    async (maxPollingAttempts = DEFAULT_EVENT_LIMIT) => {
      try {
        // If already running and new limit isn't higher, don't restart
        if (intervalId.current && maxPollingAttempts <= maxAttempts.current) {
          return;
        }

        // Clean up existing listeners/intervals
        cleanup();

        // Set new limits
        maxAttempts.current = maxPollingAttempts;
        currentAttempts.current = 0;

        // Start polling interval
        intervalId.current = setInterval(async () => {
          currentAttempts.current += 1;

          try {
            const data = await getSparkBalance();
            if (data.didWork) {
              const hashedData = sha256Hash(JSON.stringify(data.tokensObj));
              console.log(prevData.current);
              console.log(hashedData);
              if (prevData.current !== hashedData && prevData.current) {
                cleanup();
              } else {
                prevData.current = hashedData;
              }
            }
          } catch (error) {
            console.error('Error getting spark balance:', error);
          }

          // Stop polling when max attempts reached
          if (currentAttempts.current >= maxAttempts.current) {
            clearInterval(intervalId.current);
            intervalId.current = null;
            console.log(
              `LRC20 polling completed after ${currentAttempts.current} attempts`,
            );
          }
        }, POLLING_INTERVAL_MS);

        console.log(
          `Started LRC20 polling with ${maxPollingAttempts} max attempts`,
        );
      } catch (error) {
        console.error('Failed to start LRC20 event listener:', error);
        cleanup();
      }
    },
    [cleanup],
  );

  const stopLrc20EventListener = useCallback(() => {
    cleanup();
    console.log('LRC20 event listener stopped manually');
  }, [cleanup]);

  const getListenerStatus = useCallback(() => {
    return {
      isRunning: !!intervalId.current,
      currentAttempts: currentAttempts.current,
      maxAttempts: maxAttempts.current,
    };
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const contextValue = useMemo(
    () => ({
      startLrc20EventListener,
      stopLrc20EventListener,
      getListenerStatus,
    }),
    [startLrc20EventListener, stopLrc20EventListener, getListenerStatus],
  );

  return (
    <LRC20EventContext.Provider value={contextValue}>
      {children}
    </LRC20EventContext.Provider>
  );
}

export const useLRC20EventContext = () => {
  const context = useContext(LRC20EventContext);
  if (!context) {
    throw new Error(
      'useLRC20EventContext must be used within LRC20EventProvider',
    );
  }
  return context;
};
