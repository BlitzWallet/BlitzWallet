import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../app/functions/localStorage';
import { getRecentExternalIncomingIds } from '../app/functions/spark/transactions';
import { hasFullHistoryPass } from '../app/functions/spark/paymentIngest';
import { useSparkWallet } from './sparkContext';

const ActivitySeenContext = createContext(null);

const ACTIVITY_SEEN_STORAGE_PREFIX = 'UNSEEN_ACTIVITY_TX_';
// Coalesces the burst of tx events a restore/claim pass can emit into one read.
const CHECK_DEBOUNCE_MS = 300;

const getSeenStorageKey = accountId =>
  `${ACTIVITY_SEEN_STORAGE_PREFIX}${accountId}`;

// Stored value is a JSON array of sparkIDs. null means never checked on this
// device (or an unreadable value), which re-anchors to the current history.
const readSeenIds = async accountId => {
  const stored = await getLocalStorageItem(getSeenStorageKey(accountId));
  if (stored === null) return null;
  try {
    const ids = JSON.parse(stored);
    return Array.isArray(ids) ? new Set(ids) : null;
  } catch {
    return null;
  }
};

const saveSeenIds = (accountId, ids) =>
  setLocalStorageItem(getSeenStorageKey(accountId), JSON.stringify(ids));

// Tracks whether an external (spark/lightning/bitcoin) payment arrived since the
// user last opened the activity page. The check runs on txsVersion only, so it
// never polls the transaction database.
export function ActivitySeenProvider({ children }) {
  const { sparkInformation, txsVersion } = useSparkWallet();
  const accountId = sparkInformation.identityPubKey;
  const [hasUnseenActivity, setHasUnseenActivity] = useState(false);

  // { accountId, loaded, seenIds }. seenIds is the Set of recent external
  // incoming sparkIDs the user has acknowledged.
  const seenStateRef = useRef({
    accountId: null,
    loaded: false,
    seenIds: null,
  });
  const requestIdRef = useRef(0);
  const accountIdRef = useRef(accountId);
  accountIdRef.current = accountId;

  useEffect(() => {
    if (!accountId) {
      seenStateRef.current = { accountId: null, loaded: false, seenIds: null };
      setHasUnseenActivity(false);
      return;
    }

    if (seenStateRef.current.accountId !== accountId) {
      seenStateRef.current = { accountId, loaded: false, seenIds: null };
      setHasUnseenActivity(false);
    }

    const requestId = ++requestIdRef.current;
    let cancelled = false;
    const isStale = () => cancelled || requestId !== requestIdRef.current;

    const timer = setTimeout(async () => {
      try {
        // Read the import flag before the rows: once it is true, every
        // restored row is already in the table this read sees.
        const historyImported = await hasFullHistoryPass(accountId);
        const recentIds = await getRecentExternalIncomingIds(accountId);
        if (isStale() || !recentIds) return;

        const seenState = seenStateRef.current;
        if (seenState.accountId !== accountId) return;

        if (!seenState.loaded) {
          seenState.seenIds = await readSeenIds(accountId);
          if (isStale()) return;
          seenState.loaded = true;
        }

        // Until this device has imported the wallet's history once, rows that
        // land are restored history, not new activity. Drop any anchor so the
        // first check after the import takes a fresh one.
        if (!historyImported) {
          seenState.seenIds = null;
          setHasUnseenActivity(false);
          return;
        }

        if (!seenState.seenIds) {
          seenState.seenIds = new Set(recentIds);
          await saveSeenIds(accountId, recentIds);
          if (isStale()) return;
          setHasUnseenActivity(false);
          return;
        }

        setHasUnseenActivity(recentIds.some(id => !seenState.seenIds.has(id)));
      } catch (err) {
        console.log('activity seen check error', err);
      }
    }, CHECK_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accountId, txsVersion]);

  const markActivitySeen = useCallback(async () => {
    const currentAccountId = accountIdRef.current;
    if (!currentAccountId) return;

    setHasUnseenActivity(false);
    try {
      const historyImported = await hasFullHistoryPass(currentAccountId);
      const recentIds = await getRecentExternalIncomingIds(currentAccountId);
      if (!recentIds || accountIdRef.current !== currentAccountId) return;

      const seenState = seenStateRef.current;
      if (seenState.accountId !== currentAccountId) return;
      seenState.loaded = true;
      // Mid-import: rows still landing would be compared against this set, so
      // leave the anchor to the first check after the import.
      seenState.seenIds = historyImported ? new Set(recentIds) : null;
      if (historyImported) await saveSeenIds(currentAccountId, recentIds);
    } catch (err) {
      console.log('activity seen mark error', err);
    }
  }, []);

  const value = useMemo(
    () => ({ hasUnseenActivity, markActivitySeen }),
    [hasUnseenActivity, markActivitySeen],
  );

  return (
    <ActivitySeenContext.Provider value={value}>
      {children}
    </ActivitySeenContext.Provider>
  );
}

export const useActivitySeen = () => useContext(ActivitySeenContext);
