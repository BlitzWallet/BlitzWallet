import {
  createContext,
  useState,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  attachWalletListeners,
  clearMnemonicCache,
  getSingleTxDetails,
  getSparkTransactions,
  initializeFlashnet,
  selectSparkRuntime,
  sparkWallet,
  getOptimizationLockedSats,
} from '../app/functions/spark';
import { createBalanceEngine } from '../app/functions/spark/balanceEngine';
import { clearEnrichedTxCache } from '../app/functions/spark/enrichedTxCache';
import { disposeWalletViewer } from '../app/functions/spark/walletViewer';
import {
  claimDepositUtxo,
  fetchAllIdentityDepositUtxos,
} from '../app/functions/spark/depositClaim';
import {
  bulkUpdateSparkTransactions,
  insertSparkTransactionPlaceholders,
  getAllSparkTransactions,
  getAllSparkContactInvoices,
  getAllUnpaidSparkLightningInvoices,
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from '../app/functions/spark/transactions';
import { useAppStatus } from './appStatus';
import {
  fullRestoreSparkState,
  updateSparkTxStatus,
} from '../app/functions/spark/restore';
import { hasPendingTxDrift } from '../app/functions/spark/pendingTxDrift';
import { useGlobalContactsInfo } from './globalContacts';
import { initWallet } from '../app/functions/initiateWalletConnection';
// import { useNodeContext } from './nodeContext';
import { AppState, InteractionManager } from 'react-native';
import { useKeysContext } from './keys';
import {
  clearSpendAndReplaceCorrelationMemo,
  setSpendAndReplaceAuthGetter,
} from '../app/functions/spark/spendAndReplaceCorrelation';
import { navigationRef } from '../navigation/navigationService';
import { transformTxToPaymentObject } from '../app/functions/spark/transformTxToPayment';
import EventEmitter from 'events';
import { getLRC20Transactions } from '../app/functions/lrc20';
import { useActiveCustodyAccount } from './activeAccount';
import sha256Hash from '../app/functions/hash';
import {
  INCOMING_SPARK_TX_NAME,
  incomingSparkTransaction,
  BALANCE_UPDATE_EVENT_NAME,
  sparkBalanceUpdateEmitter,
  TOKEN_BALANCE_UPDATE_EVENT_NAME,
  sparkTokenBalanceUpdateEmitter,
  STREAM_STATUS_EVENT_NAME,
  sparkStreamStatusEmitter,
  OPERATION_TYPES,
  sendWebViewRequestGlobal,
  useWebView,
} from './webViewContext';
import { useGlobalContextProvider } from './context';
import { useAuthContext } from './authContext';
import {
  createRestorePoller,
  getBalanceWithTimeout,
  getSparkLeavesWithTimeout,
  getSparkExitNodesForLeavesWithTimeout,
} from '../app/functions/pollingManager';
import {
  replaceAllLeaves,
  getGlobalLeafStats,
  getPendingExitNodeLeafIds,
  saveExitNodesForLeaf,
  getExitNodeSyncProgress,
} from '../app/functions/spark/leavesStorage';
import { USDB_TOKEN_ID } from '../app/constants';
import { saveAccountBalanceSnapshot } from '../app/functions/spark/balanceSnapshots';
import { mergeAndCacheTokens } from '../app/functions/lrc20/cachedTokens';
import { isFlashnetTransfer } from '../app/functions/spark/handleFlashnetTransferIds';
import { filterDisplayableTransactions } from '../app/functions/spark/filterTransactions';
import { getCachedTokenImages } from '../app/functions/spark/tokenImageCache';
import { useToastActions } from './toastManager';
import { clearSharedSecretCache } from '../app/functions/messaging/encodingAndDecodingMessages';

export const isSendingPayingEventEmiiter = new EventEmitter();
export const SENDING_PAYMENT_EVENT_NAME = 'SENDING_PAYMENT_EVENT';

if (!global.blitzWalletSparkIntervalState) {
  global.blitzWalletSparkIntervalState = {
    intervalTracker: new Map(),
    listenerLock: new Map(),
    allIntervalIds: new Set(),
    depositIntervalIds: new Set(),
  };
}
const { intervalTracker, listenerLock, allIntervalIds, depositIntervalIds } =
  global.blitzWalletSparkIntervalState;

const TX_REFRESH_UPDATE_TYPES = new Set([
  'transactions',
  'txStatusUpdate',
  'lrc20Payments',
  'contactDetailsUpdate',
  'incrementalRestore',
  'incomingPayment',
  'fullUpdate',
  'fullUpdate-waitBalance',
  'fullUpdate-tokens',
  'paymentWrapperTx',
]);

const BALANCE_INTENT_UPDATE_TYPES = new Set([
  'fullUpdate-waitBalance',
  'paymentWrapperTx',
  'fullUpdate',
  'fullUpdate-tokens',
]);

const SKIP_CONFIRM_NAV_UPDATE_TYPES = new Set([
  'paymentWrapperTx',
  'transactions',
  'txStatusUpdate',
  'lrc20Payments',
  'contactDetailsUpdate',
  'incrementalRestore',
]);

// Send screens where an incoming-payment toast would obscure the send UI. Keyed
// by the route names registered in navigation/screens.js.
const BLOCKED_TOAST_ROUTE_NAMES = new Set([
  'ConfirmPaymentScreen', // sendPaymentScreen.js
  'ConfirmSplitPayment', // confirmSplitPayment.js
  'StablecoinSendScreen', // stablecoinSendScreen.js
]);

// Bounded read windows for homepage tx projection. Escalated only when a full
// window still can't fill the display limit; the final fallback is the legacy
// unbounded read.
const TX_WINDOW_TIERS = [200, 800];

// Retries for an incoming transfer whose fetch, transform or write failed
// (its placeholder row would otherwise stay pending forever).
const INCOMING_RETRY_DELAYS = [2000, 8000, 30000];

// See scheduleCommitRestore in the provider.
const COMMIT_RESTORE_DELAY_MS = 2500;
// While the sending flag is set, decreases and token updates are held, so a
// send path that misses its `false` must not hold them forever.
const SENDING_FLAG_MAX_MS = 180000;

function isOnSendScreen() {
  try {
    if (!navigationRef.isReady()) return false;
    return BLOCKED_TOAST_ROUTE_NAMES.has(navigationRef.getCurrentRoute()?.name);
  } catch {
    return false;
  }
}

// Initiate context
const SparkWalletManager = createContext(null);

const SparkWalletProvider = ({ children }) => {
  const { authResetkey } = useAuthContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { changeSparkConnectionState } = useWebView();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { showToast } = useToastActions();
  const {
    didGetToHomepage,
    appState,
    // lastConnectedTimeRef
  } = useAppStatus();
  // const { liquidNodeInformation } = useNodeContext();
  const { toggleGlobalContactsInformation, globalContactsInformation } =
    useGlobalContactsInfo();
  const prevAccountMnemoincRef = useRef(null);
  const contactsPrivateKeyRef = useRef('');
  const contactsPublicKeyRef = useRef(null);
  const [sparkConnectionError, setSparkConnectionError] = useState(null);
  const isRunningAddListeners = useRef(false);
  const [sparkInformation, setSparkInformation] = useState({
    balance: 0,
    tokens: {},
    transactions: [],
    identityPubKey: '',
    sparkAddress: '',
    didConnect: null,
    didConnectToFlashnet: null,
    // Lightweight summary of the local leaves store (full leaf detail lives in
    // SQLite; the Wallet Leaves page reads it directly). Kept small on purpose —
    // the full leaf array must never live in context state.
    leaves: { count: 0, totalValue: 0, lastSyncedAt: 0 },
  });
  const [tokensImageCache, setTokensImageCache] = useState({});

  const depositAddressIntervalRef = useRef(null);
  const sparkDBaddress = useRef(null);
  const updatePendingPaymentsIntervalRef = useRef(null);
  const isInitialLRC20Run = useRef(true);
  const initialBitcoinIntervalRun = useRef(null);
  const sparkInfoRef = useRef({
    balance: 0,
    tokens: {},
    identityPubKey: '',
    sparkAddress: '',
    transactions: [],
    didConnect: false,
  });
  const sessionTimeRef = useRef(Date.now());
  const handledTransfers = useRef(new Set());
  const prevListenerType = useRef(null);
  const prevAppState = useRef(appState);
  const prevAccountId = useRef(null);
  const isSendingPaymentRef = useRef(false);
  const txPollingTimeoutRef = useRef(null);
  const txPollingAbortControllerRef = useRef(null);
  const isInitialRender = useRef(true);
  const authResetKeyRef = useRef(authResetkey);
  // One-shot latch: has the post-connect authoritative balance reconcile run for
  // this session yet? Reset in resetSparkState so an account switch re-arms it.
  const hasRunInitBalancePoll = useRef(false);
  const foregroundReconcileAppStateRef = useRef(appState);

  const txLaneQueueRef = useRef(Promise.resolve());
  const uiLaneQueueRef = useRef(Promise.resolve());
  const queueDepthRef = useRef(0);
  const eventSequenceRef = useRef(0);

  const scrollPositionRef = useRef('total');

  // Single-flight + throttle for the leaves sync. Leaves change far less often
  // than balance and syncing them is heavier (map + serialize + bulk insert of a
  // potentially large set), so we skip a sync that ran within the throttle window.
  const isReconcilingLeavesRef = useRef(false);
  const lastLeavesSyncRef = useRef(0);
  const hydratedLeavesForRef = useRef(null);
  const LEAVES_SYNC_THROTTLE_MS = 30000;

  // Single-flight + throttle for the exit-node backfill. Heavier than a leaves
  // sync (each pending leaf hits Spark operators for its ancestor chain), so it
  // runs on a longer window and piggybacks leaves syncs rather than firing on
  // every wallet event.
  const isReconcilingExitNodesRef = useRef(false);
  const lastExitNodesSyncRef = useRef(0);
  // Promise for the exit-node run currently in flight (or null). A forced
  // refresh (export) awaits this so it can never be silently dropped by the
  // single-flight guard when a background backfill happens to be running.
  const exitNodesRunRef = useRef(null);
  const EXIT_NODES_SYNC_THROTTLE_MS = 60000;
  // How many pending leaves we fetch ancestors for per operator round-trip.
  const EXIT_NODES_BATCH_SIZE = 6;

  // Tracks whether the Spark event stream has dropped, so a later
  // stream:connected is recognized as a *re*connect (which warrants one
  // reconcile read) rather than the benign initial connect.
  const streamWasDisconnectedRef = useRef(false);
  const homepageTxPreferance = masterInfoObject.homepageTxPreferance;
  const hideSmallPaymentsHomepage = masterInfoObject.hideSmallPaymentsHomepage;

  const showTokensInformation =
    masterInfoObject.enabledBTKNTokens === null
      ? !!Object.keys(sparkInformation.tokens || {}).filter(
          token => token !== USDB_TOKEN_ID,
        ).length
      : masterInfoObject.enabledBTKNTokens;

  const handledNavigatedTxs = useRef(new Set());

  const [didRunNormalConnection, setDidRunNormalConnection] = useState(false);
  const [normalConnectionTimeout, setNormalConnectionTimeout] = useState(false);
  const shouldRunNormalConnection =
    didRunNormalConnection || normalConnectionTimeout;
  const currentMnemonicRef = useRef(currentWalletMnemoinc);
  // Hash of the active main wallet mnemonic. Push events (balance/token/transfer)
  // are tagged with a walletId (mnemonic hash) so derived gift/pool/savings
  // wallets sharing the WebView bridge can be told apart from the main wallet.
  // We ignore any event whose walletId isn't this one. Cached here so we don't
  // re-hash on every event.
  const mainWalletHashRef = useRef(
    currentWalletMnemoinc ? sha256Hash(currentWalletMnemoinc) : null,
  );

  const cleanStatusAndLRC20Intervals = () => {
    try {
      for (const intervalId of allIntervalIds) {
        console.log('Clearing stored interval ID:', intervalId);
        clearInterval(intervalId);
      }

      intervalTracker.clear();
      allIntervalIds.clear();
    } catch (err) {
      console.log('Error cleaning lrc20 intervals', err);
    }
  };

  const clearAllDepositIntervals = () => {
    console.log(
      'Clearing all deposit address intervals. Counts:',
      depositIntervalIds.size,
    );

    for (const intervalId of depositIntervalIds) {
      console.log('Clearing deposit interval ID:', intervalId);
      clearInterval(intervalId);
    }

    depositIntervalIds.clear();
    console.log('All deposit intervals cleared');
  };

  useEffect(() => {
    authResetKeyRef.current = authResetkey;
  }, [authResetkey]);

  useEffect(() => {
    sparkInfoRef.current = {
      ...sparkInfoRef.current,
      balance: sparkInformation.balance,
      tokens: sparkInformation.tokens,
      identityPubKey: sparkInformation.identityPubKey,
      sparkAddress: sparkInformation.sparkAddress,
      didConnect: sparkInformation.didConnect,
    };
  }, [
    sparkInformation.balance,
    sparkInformation.tokens,
    sparkInformation.identityPubKey,
    sparkInformation.sparkAddress,
    sparkInformation.didConnect,
  ]);

  useEffect(() => {
    currentMnemonicRef.current = currentWalletMnemoinc;
    mainWalletHashRef.current = currentWalletMnemoinc
      ? sha256Hash(currentWalletMnemoinc)
      : null;
  }, [currentWalletMnemoinc]);

  useEffect(() => {
    // Fixing race condition with new preloaded txs
    sessionTimeRef.current = Date.now() + 5 * 1000;
  }, [currentWalletMnemoinc, authResetkey]);

  useEffect(() => {
    if (!didGetToHomepage) return;
    const timer = setTimeout(() => {
      setNormalConnectionTimeout(true);
    }, 20000);

    return () => clearTimeout(timer);
  }, [didGetToHomepage]);

  useEffect(() => {
    async function handleWalletStateChange() {
      if (!didGetToHomepage) return;
      if (!sparkInfoRef.current.identityPubKey) return;
      if (changeSparkConnectionState.state == null) return;
      if (!changeSparkConnectionState.state) {
        // The page reloads and forgets its listeners; the attach effect must
        // add them again once the wallet is back (didConnect → true).
        prevListenerType.current = null;
        setSparkInformation(prev => ({ ...prev, didConnect: false }));
      } else {
        let alreadyRanConnection = false;
        if (!sparkInfoRef.current.identityPubKey && shouldRunNormalConnection) {
          await resetSparkState(true, false);
          await connectToSparkWallet();
          await initializeFlashnet(currentMnemonicRef.current);
          alreadyRanConnection = true;
        } else {
          setSparkInformation(prev => ({
            ...prev,
            didConnect: !!prev.identityPubKey,
          }));
        }

        const runtime = await selectSparkRuntime(
          currentMnemonicRef.current,
          false,
          undefined,
          false,
        );
        if (runtime === 'native') {
          if (!alreadyRanConnection) {
            await resetSparkState(true, false);
            await connectToSparkWallet(sparkInfoRef.current.identityPubKey);
            await initializeFlashnet(currentMnemonicRef.current);
          }
        }
      }
    }
    handleWalletStateChange();
  }, [
    changeSparkConnectionState,
    didGetToHomepage,
    shouldRunNormalConnection,
    resetSparkState,
    connectToSparkWallet,
  ]);

  useEffect(() => {
    if (!sparkInfoRef.current?.tokens) return;

    async function updateTokensImageCache() {
      const tokenIds = Object.keys(sparkInfoRef.current.tokens);
      const newCache = await getCachedTokenImages(tokenIds);
      setTokensImageCache(prev => ({ ...prev, ...newCache }));
    }

    updateTokensImageCache();
  }, [Object.keys(sparkInformation.tokens || {}).length]);

  // Debounce refs
  const debounceTimeoutRef = useRef(null);
  const debounceMaxWaitRef = useRef(null);
  const latestIncomingBalanceRef = useRef(null);
  const pendingTransferIds = useRef(new Set());

  // Debounce refs for token-balance:update — same coalescing for token events.
  const tokenDebounceTimeoutRef = useRef(null);
  const tokenDebounceMaxWaitRef = useRef(null);
  // Token flush held while a send was in flight (see tokenBalanceUpdateHandler).
  const tokenFlushAfterSendRef = useRef(null);
  const latestTokensRef = useRef(null);
  const sendingFlagTimerRef = useRef(null);

  const toggleIsSendingPayment = useCallback(isSending => {
    console.log('Setting is sending payment', isSending);
    if (isSending) {
      if (txPollingAbortControllerRef.current) {
        txPollingAbortControllerRef.current.abort();
        txPollingAbortControllerRef.current = null;
      }
    }
    isSendingPaymentRef.current = isSending;
    clearTimeout(sendingFlagTimerRef.current);
    sendingFlagTimerRef.current = isSending
      ? setTimeout(() => {
          console.warn('Sending flag never cleared; releasing held balance');
          isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, false);
        }, SENDING_FLAG_MAX_MS)
      : null;
    const settled = engineRef.current?.onSendingChange(isSending);
    // Held token updates land with the send's sats, not ahead of them.
    if (!isSending) {
      Promise.resolve(settled).then(() => tokenFlushAfterSendRef.current?.());
    }
  }, []);

  useEffect(() => {
    if (
      !isSendingPayingEventEmiiter.listenerCount(SENDING_PAYMENT_EVENT_NAME)
    ) {
      isSendingPayingEventEmiiter.addListener(
        SENDING_PAYMENT_EVENT_NAME,
        toggleIsSendingPayment,
      );
    }

    return () => {
      console.log('clearning up toggle send pament');
      isSendingPayingEventEmiiter.removeListener(
        SENDING_PAYMENT_EVENT_NAME,
        toggleIsSendingPayment,
      );
    };
  }, [toggleIsSendingPayment]);

  const debouncedHandleIncomingPayment = useCallback(async balance => {
    if (pendingTransferIds.current.size === 0) return;

    const transferIdsToProcess = Array.from(pendingTransferIds.current);
    pendingTransferIds.current.clear();

    console.log(
      'Processing debounced incoming payments:',
      transferIdsToProcess,
    );

    // ─── Step 1: Immediately write placeholders so the restore handler
    //     sees these transfer IDs as already-present in SQLite and skips them.
    const placeholders = transferIdsToProcess.map(transferId => ({
      id: transferId,
      paymentStatus: 'pending',
      paymentType: 'unknown',
      accountId: sparkInfoRef.current.identityPubKey,
      details: {
        createdTime: Date.now(),
        isPlaceholder: true,
        direction: 'INCOMING',
      },
    }));

    try {
      await insertSparkTransactionPlaceholders(placeholders);
    } catch (error) {
      console.error('Error writing placeholder transactions:', error);
    }

    // ─── Step 2: Fetch tx details in a SINGLE batched call (one WebView
    //     message) instead of one round-trip per transfer.
    let cachedTransfers = [];

    try {
      const idSet = new Set(transferIdsToProcess);
      const { transfers = [] } = await getSparkTransactions(
        Math.min(50, transferIdsToProcess.length),
        undefined,
        currentMnemonicRef.current,
      );
      cachedTransfers = transfers.filter(transfer => idSet.has(transfer.id));

      // Fallback only for ids NOT in the batch window (e.g. an older transfer
      // that settled while many newer transfers arrived in the same burst).
      // Normal load hits zero of these, so the single-message goal holds; this
      // just stops a dropped id from being stuck as a pending placeholder.
      const foundIds = new Set(cachedTransfers.map(transfer => transfer.id));
      const missingIds = transferIdsToProcess.filter(id => !foundIds.has(id));
      for (const transferId of missingIds) {
        const transfer = await getSingleTxDetails(
          currentMnemonicRef.current,
          transferId,
        );
        if (transfer) cachedTransfers.push(transfer);
      }
    } catch (error) {
      console.error('Error fetching batched incoming payments:', error);
    }

    const paymentObjects = [];
    // Transfers this pass turned into a row (or left to the deposit path).
    // The rest keep their placeholder: nothing else resolves it (the status
    // scan and restore both skip placeholders), so they are retried below.
    const handledIds = new Set();

    const [unpaidInvoices, unpaidContactInvoices] = await Promise.all([
      getAllUnpaidSparkLightningInvoices(),
      getAllSparkContactInvoices(),
    ]);

    for (const transferId of transferIdsToProcess) {
      const tx = cachedTransfers.find(t => t.id === transferId);
      if (!tx) continue;

      // Skip UTXO_SWAP handling here — old logic kept
      if (tx.type === 'UTXO_SWAP') {
        handledIds.add(transferId);
        continue;
      }

      let paymentObj = null;
      try {
        paymentObj = await transformTxToPaymentObject(
          tx,
          sparkInfoRef.current.sparkAddress,
          undefined,
          false,
          unpaidInvoices,
          sparkInfoRef.current.identityPubKey,
          1,
          undefined,
          unpaidContactInvoices,
          currentMnemonicRef.current,
        );
      } catch (error) {
        console.error('Error transforming incoming payment:', error);
      }

      if (paymentObj) {
        paymentObjects.push(paymentObj);
        handledIds.add(transferId);
      }
    }

    if (!paymentObjects.length) {
      retryIncomingTransfers(
        transferIdsToProcess.filter(id => !handledIds.has(id)),
      );
      return;
    }

    let didWrite = false;
    try {
      didWrite = await bulkUpdateSparkTransactions(
        paymentObjects,
        isSendingPaymentRef.current ? 'transactions' : 'incomingPayment',
        0,
        balance,
      );
    } catch (error) {
      console.error('bulkUpdateSparkTransactions failed:', error);
    }
    retryIncomingTransfers(
      transferIdsToProcess.filter(id => !didWrite || !handledIds.has(id)),
    );
  }, []);

  // Bounded retry for incoming transfers whose fetch, transform or write
  // failed. Stale after a reset or wallet change. A retry carries no claim
  // balance: by then it is stale (the balance itself arrives via events).
  const incomingRetriesRef = useRef(new Map());
  const incomingRetryTimersRef = useRef(new Set());
  const retryIncomingTransfers = transferIds => {
    const mnemonic = currentMnemonicRef.current;
    for (const transferId of transferIds) {
      const attempt = incomingRetriesRef.current.get(transferId) ?? 0;
      if (attempt >= INCOMING_RETRY_DELAYS.length) {
        incomingRetriesRef.current.delete(transferId);
        console.error('Giving up on incoming transfer:', transferId);
        continue;
      }
      incomingRetriesRef.current.set(transferId, attempt + 1);
      const timer = setTimeout(() => {
        incomingRetryTimersRef.current.delete(timer);
        if (mnemonic !== currentMnemonicRef.current) return;
        pendingTransferIds.current.add(transferId);
        debouncedHandleIncomingPayment(null);
      }, INCOMING_RETRY_DELAYS[attempt]);
      incomingRetryTimersRef.current.add(timer);
    }
  };
  const clearIncomingRetries = () => {
    for (const timer of incomingRetryTimersRef.current) clearTimeout(timer);
    incomingRetryTimersRef.current.clear();
    incomingRetriesRef.current.clear();
  };

  const filterAndSetTransactions = useCallback(
    freshTxs => {
      sparkInfoRef.current.transactions = freshTxs.slice(0, 50);
      const filtered = filterDisplayableTransactions({
        transactions: freshTxs,
        scrollPosition: scrollPositionRef.current,
        enabledLRC20: showTokensInformation,
        tokens: sparkInfoRef.current.tokens,
        limit: homepageTxPreferance,
        hideSmallPaymentsHomepage,
      });
      setSparkInformation(prev => ({ ...prev, transactions: filtered }));
    },
    [showTokensInformation, homepageTxPreferance, hideSmallPaymentsHomepage],
  );

  // Tiered homepage projection. Tier 0 filters the newest ~50 rows — from
  // the in-memory window for pure UI changes (pager swipes: zero I/O, last
  // call wins by ordering), or re-read from SQLite when callers know rows
  // were written since the window was captured (`refreshFromDb` — tx
  // events), since the window alone cannot see new payments. Bounded reads
  // escalate only while a FULL window suggests deeper rows may still match,
  // so sparse histories (e.g. few USD txs deep in the table) stay correct
  // without defaulting to full scans. Nothing is committed until a tier
  // fills the display limit or the table is provably exhausted — the UI
  // keeps showing the previous list rather than flashing an incomplete one,
  // matching the original single-commit behavior. When `scrollPosition` is
  // provided, async work aborts if the user swiped again mid-flight.
  // Returns the raw rows behind the commit (null if superseded).
  const projectHomepageTxs = useCallback(
    async ({
      limitNeeded,
      scrollPosition = null,
      smallPaymentOverrides = null,
      refreshFromDb = false,
    }) => {
      const { identityPubKey } = sparkInfoRef.current;
      if (!identityPubKey) return null;

      const hasScrollGuard = scrollPosition !== null;
      const isStale = () =>
        hasScrollGuard && scrollPositionRef.current !== scrollPosition;

      const runFilter = txs =>
        filterDisplayableTransactions({
          transactions: txs,
          scrollPosition: scrollPosition ?? scrollPositionRef.current,
          enabledLRC20: showTokensInformation,
          tokens: sparkInfoRef.current.tokens,
          limit: limitNeeded,
          hideSmallPaymentsHomepage:
            smallPaymentOverrides ?? hideSmallPaymentsHomepage,
        });

      const commit = filtered =>
        setSparkInformation(prev => ({ ...prev, transactions: filtered }));

      let searchPool = sparkInfoRef.current.transactions;

      if (refreshFromDb) {
        if (isStale()) return null;
        searchPool = await getAllSparkTransactions({
          limit: 50,
          accountId: identityPubKey,
        });
        if (isStale()) return null;
        sparkInfoRef.current.transactions = searchPool.slice(0, 50);
        if (!searchPool.length) {
          commit([]);
          return searchPool;
        }
      }

      if (searchPool.length) {
        const filtered = runFilter(searchPool);
        const tableExhausted = refreshFromDb && searchPool.length < 50;
        if (filtered.length >= limitNeeded || tableExhausted) {
          commit(filtered);
          return searchPool;
        }
      }

      for (const windowSize of TX_WINDOW_TIERS) {
        if (isStale()) return null;
        const rows = await getAllSparkTransactions({
          limit: windowSize,
          accountId: identityPubKey,
        });
        if (isStale()) return null;
        sparkInfoRef.current.transactions = rows.slice(0, 50);
        const filtered = runFilter(rows);
        if (filtered.length >= limitNeeded || rows.length < windowSize) {
          commit(filtered);
          return rows;
        }
      }

      if (isStale()) return null;
      const allTxs = await getAllSparkTransactions({
        limit: null,
        accountId: identityPubKey,
      });
      if (isStale()) return null;
      sparkInfoRef.current.transactions = allTxs.slice(0, 50);
      const filtered = runFilter(allTxs);
      commit(filtered);
      return allTxs;
    },
    [showTokensInformation, homepageTxPreferance, hideSmallPaymentsHomepage],
  );

  const updateHomepageScrollPosition = useCallback(
    async pos => {
      scrollPositionRef.current = pos;
      // Skip while the key is unset (init) so we don't clobber a list another
      // path populated.
      if (!sparkInfoRef.current.identityPubKey) return;
      await projectHomepageTxs({
        limitNeeded: homepageTxPreferance,
        scrollPosition: pos,
      });
    },
    [projectHomepageTxs, homepageTxPreferance],
  );

  const updateHomepageTxPreferance = useCallback(
    async (num, smallPaymentOverrides) => {
      await projectHomepageTxs({
        limitNeeded: num,
        smallPaymentOverrides,
      });
    },
    [projectHomepageTxs],
  );

  const enqueueTxLane = useCallback((updateType, task) => {
    queueDepthRef.current += 1;
    console.log(
      `[TxLane] +1 (${updateType}) -> depth: ${queueDepthRef.current}`,
    );

    txLaneQueueRef.current = txLaneQueueRef.current
      .then(task)
      .catch(err => console.log('[TxLane] task error', updateType, err))
      .finally(() => {
        queueDepthRef.current -= 1;
        console.log(
          `[TxLane] -1 (${updateType}) -> depth: ${queueDepthRef.current}`,
        );
      });

    return txLaneQueueRef.current;
  }, []);

  const enqueueUiLane = useCallback((updateType, task) => {
    uiLaneQueueRef.current = uiLaneQueueRef.current
      .then(task)
      .catch(err => console.log('[UiLane] task error', updateType, err));

    return uiLaneQueueRef.current;
  }, []);

  const maybeHandleConfirmNavigation = useCallback(
    async (updateType, txs = null, from) => {
      try {
        if (SKIP_CONFIRM_NAV_UPDATE_TYPES.has(updateType)) return;

        const { identityPubKey } = sparkInfoRef.current;
        if (!identityPubKey) return;

        let lastAddedTx;
        if (txs) {
          lastAddedTx = txs[0];
        } else {
          [lastAddedTx] = await getAllSparkTransactions({
            accountId: identityPubKey,
            limit: 1,
          });
        }

        if (!lastAddedTx) return;

        let parsedDetails = {};
        try {
          parsedDetails = JSON.parse(lastAddedTx.details || '{}');
        } catch {
          parsedDetails = {};
        }

        const parsedTx = {
          ...lastAddedTx,
          details: parsedDetails,
        };
        const details = parsedTx.details || {};

        if (parsedTx.paymentStatus === 'pending') {
          // Run a tx status check. Will delay toast message
          // but will prevent a stale pending stae from making the trasnsaction show pending after toast message
          const { updated } = await updateSparkTxStatus(
            currentMnemonicRef.current,
            sparkInfoRef.current.identityPubKey,
            true,
            contactsPrivateKey,
            publicKey,
          );
          const didUpdateStatus = updated.find(
            tx =>
              tx.tempId === parsedTx.sparkID &&
              tx.paymentStatus === 'completed',
          );
          if (!didUpdateStatus) {
            console.log('Payment is pending, show navigation once confimred');
            return;
          }
        }

        if (isFlashnetTransfer(parsedTx.sparkID)) {
          console.log('Failed swap refund, do not show tosat here');
          return;
        }

        if (
          details.senderIdentityPublicKey === process.env.SPARK_IDENTITY_PUBKEY
        ) {
          console.log('Refund from Spark, do not show tosat here');
          return;
        }

        const txTime = new Date(details.time).getTime();
        if (Number.isFinite(txTime) && txTime < sessionTimeRef.current) {
          console.log(
            'created before session time was set, skipping confirm tx page navigation',
          );
          return;
        }

        if (parsedTx?.paymentStatus?.toLowerCase() === 'failed') {
          console.log('This payment is of type failed, do not navigate here');
          return;
        }

        if (details.performSwaptoUSD) {
          console.log(
            'This payment is being used to perform a swap, do not navigate here.',
          );
          return;
        }

        if (isSendingPaymentRef.current) {
          console.log(
            'Is sending payment, skipping confirm tx page navigation',
          );
          return;
        }

        if (details.direction === 'OUTGOING') {
          console.log(
            'Only incoming payments navigate here, skipping confirm tx page navigation',
          );
          return;
        }

        if (details.isHoldInvoice && parsedTx.paymentStatus !== 'completed') {
          console.log('Blocking unconfirmed hodl invoice from showing');
          return;
        }

        if (handledNavigatedTxs.current.has(parsedTx.sparkID)) {
          console.log(
            'Already handled transaction, skipping confirm tx page navigation',
          );
          return;
        }
        handledNavigatedTxs.current.add(parsedTx.sparkID);

        if (isOnSendScreen()) {
          console.log('On a send screen — suppressing incoming payment toast');
          return;
        }

        // const isOnReceivePage =
        //   navigationRef
        //     .getRootState()
        //     .routes?.filter(item => item.name === 'ReceiveBTC').length === 1;

        // const hasPaymentTime = !!details.createdTime || !!details.time;
        // const isNewestPayment = hasPaymentTime
        //   ? new Date(details.createdTime || details.time).getTime() >
        //     newestPaymentTimeRef.current
        //   : false;

        // let shouldShowConfirm = false;
        // if (
        //   (lastAddedTx.paymentType?.toLowerCase() === 'lightning' &&
        //     !details.isLNURL &&
        //     !details.shouldNavigate &&
        //     isOnReceivePage &&
        //     isNewestPayment) ||
        //   (lastAddedTx.paymentType?.toLowerCase() === 'spark' &&
        //     !details.isLRC20Payment &&
        //     isOnReceivePage &&
        //     isNewestPayment)
        // ) {
        //   if (lastAddedTx.paymentType?.toLowerCase() === 'spark') {
        //     const unpaidLNInvoices = await getAllUnpaidSparkLightningInvoices();
        //     const lastMatch = unpaidLNInvoices.findLast(invoice => {
        //       const savedInvoiceDetails = JSON.parse(invoice.details);
        //       return (
        //         !savedInvoiceDetails.sendingUUID &&
        //         !savedInvoiceDetails.isLNURL &&
        //         invoice.amount === details.amount
        //       );
        //     });

        //     if (lastMatch && !usedSavedTxIds.current.has(lastMatch.id)) {
        //       usedSavedTxIds.current.add(lastMatch.id);
        //       const lastInvoiceDetails = JSON.parse(lastMatch.details);
        //       if (details.time - lastInvoiceDetails.createdTime < 60 * 1000) {
        //         shouldShowConfirm = true;
        //       }
        //     }
        //   } else {
        //     shouldShowConfirm = true;
        //   }
        // }

        showToast({
          amount: details.amount,
          LRC20Token: details.LRC20Token,
          isLRC20Payment: !!details.LRC20Token,
          duration: 7000,
          isSARPayment: !!details.isSARIncoming,
          type: 'confirmTx',
        });
      } catch (err) {
        console.log('[UiLane] confirm navigation error', err);
      }
    },
    [showToast],
  );

  const projectTransactionsForEvent = useCallback(
    async event => {
      const { identityPubKey } = sparkInfoRef.current;
      if (!identityPubKey) {
        console.warn(
          'Skipping tx projection because identityPubKey is not ready yet',
        );
        return;
      }

      const txs = await projectHomepageTxs({
        limitNeeded: homepageTxPreferance,
        refreshFromDb: true,
      });

      enqueueUiLane(event.updateType, () =>
        maybeHandleConfirmNavigation(
          event.updateType,
          txs,
          'project transactions for event',
        ),
      );
    },
    [
      enqueueUiLane,
      maybeHandleConfirmNavigation,
      projectHomepageTxs,
      homepageTxPreferance,
    ],
  );

  // Refreshes the local leaves store from a live getLeaves() snapshot, then
  // updates the small in-context summary. Single-flight + throttled; the heavy
  // map/serialize/insert work is deferred behind InteractionManager so it never
  // competes with navigation or gestures. The fetch uses the fast coordinator
  // path (isBalanceCheck=true) — the export flow forces a full getLeaves(false).
  // Incrementally caches each exit-eligible leaf's ancestor TreeNodes so the
  // local export bundle can drive an OFFLINE multi-level unilateral exit. Driven
  // purely by DB `pending` flags, so it is automatically resumable: any leaf left
  // pending (fetch failed/timed out, app backgrounded, account switched, or leaf
  // missing from this snapshot) is retried on a later reconcile. Single-flight +
  // throttled (longer window than leaves). Scoped to the captured account, so an
  // account switch mid-run can only no-op against the old account.
  const reconcileExitNodes = useCallback(async (rawLeaves, force = false) => {
    const identityPubKey = sparkInfoRef.current.identityPubKey;
    const mnemonic = currentMnemonicRef.current;
    if (!identityPubKey || !mnemonic) return;
    if (!Array.isArray(rawLeaves)) return;

    if (isReconcilingExitNodesRef.current) {
      // A run is already in flight. Background calls stay single-flight and are
      // dropped. A forced refresh (export) must not be silently skipped: wait
      // for the in-flight run to finish, then run our forced pass so the export
      // bundle is built from freshly fetched ancestor chains.
      if (!force) return;
      try {
        await exitNodesRunRef.current;
      } catch {}
    }

    if (
      !force &&
      Date.now() - lastExitNodesSyncRef.current < EXIT_NODES_SYNC_THROTTLE_MS
    )
      return;

    const run = (async () => {
      isReconcilingExitNodesRef.current = true;
      try {
        const leafById = new Map(
          rawLeaves.filter(leaf => leaf?.id).map(leaf => [leaf.id, leaf]),
        );
        let pendingIds;

        while (true) {
          if (AppState.currentState !== 'active') break;
          if (mnemonic !== currentMnemonicRef.current) break;

          let batchLeaves;

          if (force) {
            // Process the provided leaves directly once.
            batchLeaves = rawLeaves;
          } else {
            pendingIds = await getPendingExitNodeLeafIds(
              identityPubKey,
              EXIT_NODES_BATCH_SIZE,
            );

            if (!pendingIds.length) break;

            batchLeaves = [];
            for (const id of pendingIds) {
              const leaf = leafById.get(id);
              if (leaf) batchLeaves.push(leaf);
            }

            if (!batchLeaves.length) break;
          }

          const exitNodesMap = await getSparkExitNodesForLeavesWithTimeout(
            mnemonic,
            batchLeaves,
          );

          if (mnemonic !== currentMnemonicRef.current) break;

          // Persist every leaf the fetch succeeded on (present in the map).
          // Leaves absent from the map stay pending and are retried later.
          let markedThisBatch = 0;
          for (const leaf of batchLeaves) {
            if (!(leaf.id in exitNodesMap)) continue;
            const didMark = await saveExitNodesForLeaf(
              identityPubKey,
              leaf.id,
              exitNodesMap[leaf.id],
            );
            if (didMark) markedThisBatch++;
          }

          if (force) {
            // Only process the supplied leaves once.
            break;
          }

          if (markedThisBatch === 0) break;

          // Yield between batches so the operator round-trips never starve frames.
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (!force && rawLeaves?.length > 0 && pendingIds?.length)
          lastExitNodesSyncRef.current = Date.now();

        // Reflect backfill progress into the in-context summary for the UI.
        const progress = await getExitNodeSyncProgress(identityPubKey);
        if (identityPubKey === sparkInfoRef.current.identityPubKey) {
          setSparkInformation(prev => ({
            ...prev,
            leaves: {
              ...(prev.leaves || {}),
              exitNodesPending: progress.pending,
              exitNodesComplete: progress.complete,
            },
          }));
        }
      } catch (err) {
        console.log('[reconcileExitNodes] error', err);
      } finally {
        isReconcilingExitNodesRef.current = false;
      }
    })();
    exitNodesRunRef.current = run;
    return run;
  }, []);

  const reconcileLeaves = useCallback(
    async (force = false) => {
      const mnemonic = currentMnemonicRef.current;
      if (!mnemonic) return;
      const identityPubKey = sparkInfoRef.current.identityPubKey;
      if (!identityPubKey) return;
      if (isReconcilingLeavesRef.current) return;
      if (
        !force &&
        Date.now() - lastLeavesSyncRef.current < LEAVES_SYNC_THROTTLE_MS
      )
        return;

      isReconcilingLeavesRef.current = true;
      try {
        const rawLeaves = await getSparkLeavesWithTimeout(mnemonic, true);
        // A null result means the read timed out / errored — keep store as-is.
        if (!Array.isArray(rawLeaves)) return;
        if (mnemonic !== currentMnemonicRef.current) return;

        await new Promise((resolve, reject) => {
          InteractionManager.runAfterInteractions(async () => {
            try {
              await replaceAllLeaves(identityPubKey, rawLeaves);
              const stats = await getGlobalLeafStats(identityPubKey);
              setSparkInformation(prev => ({
                ...prev,
                leaves: {
                  ...(prev.leaves || {}),
                  count: stats.totalLeaves,
                  totalValue: stats.totalValue,
                  lastSyncedAt: stats.lastSyncedAt,
                },
              }));
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });
        if (rawLeaves?.length) lastLeavesSyncRef.current = Date.now();
        // Backfill the exit-node ancestors for this fresh snapshot (background,
        // not awaited — it self-throttles and single-flights).
        reconcileExitNodes(rawLeaves);
      } catch (err) {
        console.log('[reconcileLeaves] error', err);
      } finally {
        isReconcilingLeavesRef.current = false;
      }
    },
    [reconcileExitNodes],
  );

  // The displayed sats balance as the balance engine last set it (engine
  // commits write it synchronously; other writers sync through the effect
  // below), so back-to-back engine decisions never compare against a value
  // that is a render behind.
  const balanceRef = useRef(sparkInformation.balance);
  useEffect(() => {
    balanceRef.current = sparkInformation.balance;
  }, [sparkInformation.balance]);

  // The history restore a balance commit asks for runs COMMIT_RESTORE_DELAY_MS
  // later (one pass per window): a receive's own claim path writes its row
  // first, so the restore finds nothing new and fires no extra balance read.
  const commitRestoreTimerRef = useRef(null);
  const scheduleCommitRestore = () => {
    if (commitRestoreTimerRef.current) return;
    commitRestoreTimerRef.current = setTimeout(() => {
      commitRestoreTimerRef.current = null;
      if (!currentMnemonicRef.current) return;
      fullRestoreSparkState({
        sparkAddress: sparkInfoRef.current.sparkAddress,
        isSendingPayment: isSendingPaymentRef.current,
        mnemonic: currentMnemonicRef.current,
        identityPubKey: sparkInfoRef.current.identityPubKey,
      });
    }, COMMIT_RESTORE_DELAY_MS);
  };
  const clearCommitRestore = () => {
    clearTimeout(commitRestoreTimerRef.current);
    commitRestoreTimerRef.current = null;
  };

  // One balance engine per wallet session (recreated after resetSparkState).
  // See app/functions/spark/balanceEngine.js for the rules.
  const engineRef = useRef(null);
  const getBalanceEngine = () => {
    if (!engineRef.current) {
      engineRef.current = createBalanceEngine({
        getDisplayed: () => balanceRef.current,
        commit: (value, { source, tokens }) => {
          const nextTokens = tokens ?? sparkInfoRef.current.tokens;
          console.log(
            `[BAL] commit ${balanceRef.current} -> ${value} (${source})`,
          );
          balanceRef.current = value;
          saveAccountBalanceSnapshot(
            sparkInfoRef.current.identityPubKey,
            value,
            nextTokens,
          );
          if (source !== 'read') {
            // Funds moved: history (e.g. a spend from another device) and
            // leaves may have changed with it.
            reconcileLeaves();
            scheduleCommitRestore();
          }
          setSparkInformation(prev =>
            prev.balance === value && (!tokens || prev.tokens === tokens)
              ? prev
              : { ...prev, balance: value, ...(tokens ? { tokens } : {}) },
          );
        },
        read: () => getBalanceWithTimeout(currentMnemonicRef.current),
        isSending: () => isSendingPaymentRef.current,
        isActive: () =>
          AppState.currentState === 'active' && !!currentMnemonicRef.current,
      });
    }
    return engineRef.current;
  };

  const handleUpdate = useCallback(
    (...args) => {
      const [updateType = 'transactions'] = args;

      const event = {
        seq: ++eventSequenceRef.current,
        updateType,
      };

      // These update types mark a funds-moving DB write (send wrapper, swap,
      // restore completion, deposit claim). The engine reads once — this is the
      // send's own settle read, so it may run while the sending flag is still
      // set: the engine holds the send's events, and native never emits
      // token-balance:update, so this read lands post-send sats and post-swap
      // token balances.
      if (BALANCE_INTENT_UPDATE_TYPES.has(updateType)) {
        getBalanceEngine().settle({ allowDuringSend: true });
        // Leaves changed alongside the balance — refresh the local store too
        // (throttled, so a burst of intents won't trigger repeated full syncs).
        reconcileLeaves();
      }

      if (!TX_REFRESH_UPDATE_TYPES.has(updateType)) {
        return Promise.resolve();
      }

      return enqueueTxLane(updateType, () =>
        projectTransactionsForEvent(event),
      );
    },
    [enqueueTxLane, projectTransactionsForEvent, reconcileLeaves],
  );

  const transferHandler = useCallback((transferId, balance, walletId) => {
    // Ignore events from derived wallets (gift/pool/savings). Undefined walletId
    // = pre-tagging bundle → treat as main wallet (backward compatible).
    if (walletId && walletId !== mainWalletHashRef.current) return;
    if (handledTransfers.current.has(transferId)) return;
    handledTransfers.current.add(transferId);
    console.log(`Transfer ${transferId} claimed. New balance: ${balance}`);

    // Add transferId to pending set
    pendingTransferIds.current.add(transferId);
    // Always flush with the most recent balance, even when the max-wait timer
    // (set on the first event of the burst) fires.
    latestIncomingBalanceRef.current = balance;

    const flush = () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      if (debounceMaxWaitRef.current) {
        clearTimeout(debounceMaxWaitRef.current);
        debounceMaxWaitRef.current = null;
      }
      debouncedHandleIncomingPayment(latestIncomingBalanceRef.current);
    };

    // Trailing debounce: flush 500ms after the last event…
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(flush, 500);

    // …but cap the wait at 10s so a sustained burst (events arriving faster
    // than every 500ms, which would perpetually reset the trailing timer and
    // never flush) still applies the balance periodically.
    if (!debounceMaxWaitRef.current) {
      debounceMaxWaitRef.current = setTimeout(flush, 10000);
    }
  }, []);

  // balance:update fires on every leaf-status change (deposits, transfers,
  // swaps, claims, optimization) with the SDK's current { available, owned,
  // incoming, optimizationLocked }; the balance engine decides what reaches
  // the display.
  const balanceUpdateHandler = useCallback((snapshot, walletId) => {
    // Ignore events from derived wallets (gift/pool/savings). Undefined
    // walletId = pre-tagging bundle → treat as main wallet (backward compatible).
    if (walletId && walletId !== mainWalletHashRef.current) return;
    console.log(
      `[BAL] available=${snapshot?.available} locked=${snapshot?.optimizationLocked} owned=${snapshot?.owned} incoming=${snapshot?.incoming}`,
    );
    getBalanceEngine().onEvent(snapshot);
  }, []);

  // token-balance:update fires when a token tx finalizes and carries the full
  // current token-balance map (getTokenBalanceMap() in the SDK). We merge that
  // payload straight into the cache instead of issuing another getSparkBalance
  // round-trip — same result, one fewer WebView read per event. The WebView
  // runtime delivers the already-normalized map; the native runtime delivers the
  // raw SDK Map and is normalized at registration (see addListeners).
  // Token analog of debouncedHandleIncomingPayment: builds token
  // (LRC20) transaction history. Driven by token-balance:update events, a one-time
  // startup fetch, and the reconnect/foreground reconcile — replacing the old 10s poll.
  const reconcileTokenTransactions = useCallback((isInitialRun = false) => {
    if (isSendingPaymentRef.current) return;
    const mnemonic = currentMnemonicRef.current;
    if (!mnemonic) return;
    getLRC20Transactions({
      ownerPublicKeys: [sparkInfoRef.current.identityPubKey],
      sparkAddress: sparkInfoRef.current.sparkAddress,
      isInitialRun,
      mnemonic,
    });
  }, []);

  const tokenBalanceUpdateHandler = useCallback(
    (tokensObject, walletId) => {
      // Ignore events from derived wallets (gift/pool/savings). Undefined walletId
      // = pre-tagging bundle → treat as main wallet (backward compatible).
      if (walletId && walletId !== mainWalletHashRef.current) return;
      // Each event carries the full current token-balance map, so only the latest
      // payload matters during a burst.
      latestTokensRef.current = tokensObject ?? {};

      const flush = async () => {
        if (tokenDebounceTimeoutRef.current) {
          clearTimeout(tokenDebounceTimeoutRef.current);
          tokenDebounceTimeoutRef.current = null;
        }
        if (tokenDebounceMaxWaitRef.current) {
          clearTimeout(tokenDebounceMaxWaitRef.current);
          tokenDebounceMaxWaitRef.current = null;
        }

        // Mid-send (e.g. a BTC→USD swap) the token side must not land before
        // the sats side: hold it until the send ends, when the engine lands
        // the held sats in the same pass.
        if (isSendingPaymentRef.current) {
          tokenFlushAfterSendRef.current = flush;
          return;
        }
        tokenFlushAfterSendRef.current = null;

        const mnemonic = currentMnemonicRef.current;
        if (!mnemonic) return;
        const merged = await mergeAndCacheTokens(
          latestTokensRef.current,
          mnemonic,
        );
        if (mnemonic !== currentMnemonicRef.current) return;
        setSparkInformation(prev => ({ ...prev, tokens: merged }));
        // Persist tokens so a token-only change survives a cold start, matching
        // the balance engine's commits.
        saveAccountBalanceSnapshot(
          sparkInfoRef.current.identityPubKey,
          sparkInfoRef.current.balance,
          merged,
        );
        // A token balance change means a token tx finalized — fetch its history now
        reconcileTokenTransactions(false);
      };

      // Trailing debounce 300ms after the last event, capped at 1s so a
      // sustained burst still flushes periodically (same window as balance).
      if (tokenDebounceTimeoutRef.current)
        clearTimeout(tokenDebounceTimeoutRef.current);
      tokenDebounceTimeoutRef.current = setTimeout(flush, 300);

      if (!tokenDebounceMaxWaitRef.current) {
        tokenDebounceMaxWaitRef.current = setTimeout(flush, 1000);
      }
    },
    [reconcileTokenTransactions],
  );

  // Stream lifecycle. A connect after a drop means events may have been missed
  // while the stream was down, so fire one reconcile read. The initial connect
  // is benign and skipped.
  const streamStatusHandler = useCallback(
    (status, walletId) => {
      // Derived wallets (gift/pool/savings) share the bridge; their stream
      // drops say nothing about the main wallet.
      if (walletId && walletId !== mainWalletHashRef.current) return;
      if (status === 'disconnected' || status === 'reconnecting') {
        streamWasDisconnectedRef.current = true;
        return;
      }
      if (status !== 'connected') return;
      if (!streamWasDisconnectedRef.current) return;
      streamWasDisconnectedRef.current = false;
      if (AppState.currentState !== 'active') return;
      if (!sparkInfoRef.current.didConnect) return;
      // The engine skips the read while a send is in flight (a mid-send read
      // returns the locked 0/partial); held events land when the send ends.
      getBalanceEngine().settle();
      // Events (including leaf changes) may have been missed while the stream
      // was down — refresh the local leaves store too.
      reconcileLeaves();
      // Recover token txs whose token-balance:update fired while the stream was down.
      reconcileTokenTransactions(false);
    },
    [reconcileLeaves, reconcileTokenTransactions],
  );

  useEffect(() => {
    if (!sparkInformation.identityPubKey) {
      console.log('Skipping listener setup - no identity pub key yet');
      return;
    }

    console.log('adding web view listeners');

    sparkTransactionsEventEmitter.on(SPARK_TX_UPDATE_ENVENT_NAME, handleUpdate);
    incomingSparkTransaction.on(INCOMING_SPARK_TX_NAME, transferHandler);
    sparkBalanceUpdateEmitter.on(
      BALANCE_UPDATE_EVENT_NAME,
      balanceUpdateHandler,
    );
    sparkTokenBalanceUpdateEmitter.on(
      TOKEN_BALANCE_UPDATE_EVENT_NAME,
      tokenBalanceUpdateHandler,
    );
    sparkStreamStatusEmitter.on(STREAM_STATUS_EVENT_NAME, streamStatusHandler);

    return () => {
      console.log('Cleaning up spark event listeners');
      sparkTransactionsEventEmitter.removeListener(
        SPARK_TX_UPDATE_ENVENT_NAME,
        handleUpdate,
      );
      incomingSparkTransaction.removeListener(
        INCOMING_SPARK_TX_NAME,
        transferHandler,
      );
      sparkBalanceUpdateEmitter.removeListener(
        BALANCE_UPDATE_EVENT_NAME,
        balanceUpdateHandler,
      );
      sparkTokenBalanceUpdateEmitter.removeListener(
        TOKEN_BALANCE_UPDATE_EVENT_NAME,
        tokenBalanceUpdateHandler,
      );
      sparkStreamStatusEmitter.removeListener(
        STREAM_STATUS_EVENT_NAME,
        streamStatusHandler,
      );
    };
  }, [
    sparkInformation.identityPubKey,
    handleUpdate,
    transferHandler,
    balanceUpdateHandler,
    tokenBalanceUpdateHandler,
    streamStatusHandler,
  ]);

  // Our handlers on the native main wallet, so teardown removes exactly them.
  const nativeHandlersRef = useRef(null);
  const detachNativeHandlers = () => {
    const bound = nativeHandlersRef.current;
    nativeHandlersRef.current = null;
    if (!bound) return;
    for (const [event, handler] of bound.handlers) {
      bound.wallet.removeListener(event, handler);
    }
  };

  const addListeners = async mode => {
    console.log('Adding Spark listeners...');
    if (AppState.currentState !== 'active') return false;

    const walletHash = sha256Hash(currentMnemonicRef.current);

    if (listenerLock.get(walletHash)) {
      console.log('addListeners already running for this wallet, skippingdh');
      // Another run owns the attach — don't report it as a failure.
      return true;
    }

    listenerLock.set(walletHash, true);

    let attached = false;

    try {
      const runtime = await selectSparkRuntime(currentMnemonicRef.current);

      if (mode === 'full') {
        if (runtime === 'native') {
          const nativeWallet = sparkWallet[walletHash];
          if (nativeWallet) {
            // This native wallet is the main wallet — tag its events with
            // walletHash so the handlers' walletId guard passes. Bound and
            // removed by reference: other code (subscribeToSparkBalance during a
            // swap send) listens on this same wallet object.
            const handlers = [
              [
                'transfer:claimed',
                (transferId, balance) =>
                  transferHandler(transferId, balance, walletHash),
              ],
              [
                'balance:update',
                // Same payload as the WebView bundle's balanceUpdate.
                balance =>
                  balanceUpdateHandler(
                    {
                      ...balance,
                      optimizationLocked: getOptimizationLockedSats(nativeWallet),
                    },
                    walletHash,
                  ),
              ],
              [
                'token-balance:update',
                // Native delivers the raw SDK event ({ tokenBalances: Map });
                // normalize it to the same token map the WebView runtime posts
                // so tokenBalanceUpdateHandler can stay runtime-agnostic.
                event => {
                  const tokensObject = {};
                  for (const [id, data] of event?.tokenBalances ?? []) {
                    tokensObject[id] = {
                      ...data,
                      balance: data.availableToSendBalance,
                    };
                  }
                  tokenBalanceUpdateHandler(tokensObject, walletHash);
                },
              ],
              ['stream:connected', () => streamStatusHandler('connected')],
              [
                'stream:disconnected',
                () => streamStatusHandler('disconnected'),
              ],
              [
                'stream:reconnecting',
                () => streamStatusHandler('reconnecting'),
              ],
            ];
            for (const [event, handler] of handlers) {
              nativeWallet.on(event, handler);
            }
            nativeHandlersRef.current = { wallet: nativeWallet, handlers };
          }
          attached = !!nativeWallet;
        } else {
          const mnemonic = currentMnemonicRef.current;
          attached = await attachWalletListeners(
            mnemonic,
            () => mnemonic !== currentMnemonicRef.current,
          );
        }
        // Single restore path for every connect (initial + subsequent). The
        // poller writes txs via bulkUpdateSparkTransactions, whose SPARK_TX
        // update event drives the UI/balance refresh; isRestoringState guards
        // against overlap.
        if (txPollingAbortControllerRef.current) {
          txPollingAbortControllerRef.current.abort();
        }

        txPollingAbortControllerRef.current = new AbortController();
        const restorePoller = createRestorePoller(
          currentMnemonicRef.current,
          isSendingPaymentRef.current,
          currentMnemonicRef,
          txPollingAbortControllerRef.current,
          result => {
            console.log('RESTORE COMPLETE');
          },
          sparkInfoRef.current,
        );

        restorePoller.start();

        updateSparkTxStatus(
          currentMnemonicRef.current,
          sparkInfoRef.current.identityPubKey,
          false,
          contactsPrivateKey,
          publicKey,
        );

        // One-time startup token history fetch (token analog of
        // restorePoller.start()) — catches token txs received while the app was
        // closed. Live updates thereafter come from token-balance:update.
        reconcileTokenTransactions(isInitialLRC20Run.current);
        if (isInitialLRC20Run.current) isInitialLRC20Run.current = false;

        if (updatePendingPaymentsIntervalRef.current) {
          console.log('BLOCKING TRYING TO SET INTERVAL AGAIN');
          clearInterval(updatePendingPaymentsIntervalRef.current);
          updatePendingPaymentsIntervalRef.current = null;
        }

        const capturedAuthKey = authResetKeyRef.current;
        const capturedMnemonic = currentMnemonicRef.current;
        const capturedWalletHash = walletHash;

        const intervalId = setInterval(async () => {
          try {
            if (capturedAuthKey !== authResetKeyRef.current) {
              console.log('Auth key changed. Aborting interval.');
              clearInterval(intervalId);
              intervalTracker.delete(capturedWalletHash);
              allIntervalIds.delete(intervalId);
              return;
            }

            if (capturedMnemonic !== currentMnemonicRef.current) {
              console.log('Mnemonic changed. Aborting interval.');
              clearInterval(intervalId);
              intervalTracker.delete(capturedWalletHash);
              allIntervalIds.delete(intervalId);
              return;
            }

            if (AppState.currentState !== 'active') {
              console.log('App not active. Skipping interval.');
              return;
            }

            const response = await updateSparkTxStatus(
              currentMnemonicRef.current,
              sparkInfoRef.current.identityPubKey,
              false,
              contactsPrivateKey,
              publicKey,
            );

            // Reconcile every tick, not only when shouldCheck: if a memory row
            // still reads "pending" but the DB no longer lists it as pending, a
            // SPARK_TX_UPDATE event was lost — re-project from the DB. Only when
            // the DB read succeeded (pendingIds present); a lock-skip/error path
            // omits it and we leave the projection untouched.
            if (
              Array.isArray(response.pendingIds) &&
              hasPendingTxDrift(
                sparkInfoRef.current.transactions,
                response.pendingIds,
              )
            ) {
              sparkTransactionsEventEmitter.emit(
                SPARK_TX_UPDATE_ENVENT_NAME,
                'transactions',
              );
            }

            // await checkHodlInvoicePaymentStatuses(
            //   currentMnemonicRef.current,
            //   sparkInfoRef.current.identityPubKey,
            // );
          } catch (err) {
            console.error('Error during periodic restore:', err);
          }
        }, 10 * 1000);

        updatePendingPaymentsIntervalRef.current = intervalId;
        intervalTracker.set(walletHash, intervalId);
        allIntervalIds.add(intervalId);
      }
    } catch (error) {
      console.error('Error in addListeners:', error);
    } finally {
      listenerLock.set(walletHash, false);
      console.log('Lock released for wallet:', walletHash);
    }

    return attached;
  };

  const removeListeners = async (onlyClearIntervals = false) => {
    console.log('Removing spark listeners');

    cleanStatusAndLRC20Intervals();

    if (!onlyClearIntervals) {
      const runtime = await selectSparkRuntime(currentMnemonicRef.current);
      detachNativeHandlers();
      if (!prevAccountMnemoincRef.current) {
        prevAccountMnemoincRef.current = currentMnemonicRef.current;
        return;
      }

      if (runtime !== 'native') {
        const response = await sendWebViewRequestGlobal(
          OPERATION_TYPES.removeListeners,
          { mnemonic: prevAccountMnemoincRef.current },
        );
        // Benign: handlers are walletId-guarded and re-adding is idempotent.
        if (!response?.didWork) {
          console.log('removeWalletEventListener failed', response?.error);
        }
      }
      prevAccountMnemoincRef.current = currentMnemonicRef.current;
    }

    // Clear debounce timeout when removing listeners
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    if (debounceMaxWaitRef.current) {
      clearTimeout(debounceMaxWaitRef.current);
      debounceMaxWaitRef.current = null;
    }
    if (tokenDebounceTimeoutRef.current) {
      clearTimeout(tokenDebounceTimeoutRef.current);
      tokenDebounceTimeoutRef.current = null;
    }
    if (tokenDebounceMaxWaitRef.current) {
      clearTimeout(tokenDebounceMaxWaitRef.current);
      tokenDebounceMaxWaitRef.current = null;
    }
    // Clear pending transfer IDs
    pendingTransferIds.current.clear();

    // Clear update payment state timer
    if (updatePendingPaymentsIntervalRef.current) {
      clearInterval(updatePendingPaymentsIntervalRef.current);
      updatePendingPaymentsIntervalRef.current = null;
    }

    if (txPollingTimeoutRef.current) {
      clearTimeout(txPollingTimeoutRef.current);
      txPollingTimeoutRef.current = null;
    }
    if (txPollingAbortControllerRef.current) {
      txPollingAbortControllerRef.current.abort();
      txPollingAbortControllerRef.current = null;
    }
  };

  const resetSparkState = useCallback(
    async (internalRefresh = false, shouldClearMnemonicCache = true) => {
      // Reset refs to initial values
      await removeListeners(true);
      if (shouldClearMnemonicCache) {
        clearMnemonicCache();
        clearSharedSecretCache();
        disposeWalletViewer();
        clearEnrichedTxCache();
      }
      detachNativeHandlers();
      prevAccountMnemoincRef.current = null;
      isRunningAddListeners.current = false;
      if (depositAddressIntervalRef.current) {
        clearInterval(depositAddressIntervalRef.current);
      }
      initialBitcoinIntervalRun.current = null;
      depositAddressIntervalRef.current = null;
      // An internal refresh (WebView → native switch) reconnects the same
      // wallet: keep what the user sees and only drop the connection.
      sparkInfoRef.current = internalRefresh
        ? { ...sparkInfoRef.current, didConnect: false }
        : {
            balance: 0,
            tokens: {},
            identityPubKey: '',
            sparkAddress: '',
            transactions: [],
            didConnect: false,
          };
      handledTransfers.current = new Set();
      handledNavigatedTxs.current.clear();
      clearIncomingRetries();
      tokenFlushAfterSendRef.current = null;
      streamWasDisconnectedRef.current = false;
      prevListenerType.current = null;
      prevAppState.current = 'active';
      prevAccountId.current = null;
      isSendingPaymentRef.current = false;
      clearTimeout(sendingFlagTimerRef.current);
      txPollingAbortControllerRef.current = null;
      txPollingTimeoutRef.current = null;
      hasRunInitBalancePoll.current = false;
      // In-flight reads and staged events belong to the old session.
      engineRef.current?.dispose();
      engineRef.current = null;
      clearCommitRestore();

      txLaneQueueRef.current = Promise.resolve();
      uiLaneQueueRef.current = Promise.resolve();
      queueDepthRef.current = 0;
      eventSequenceRef.current = 0;

      // Reset state variables
      setSparkConnectionError(null);
      setSparkInformation(prev =>
        internalRefresh
          ? { ...prev, didConnect: null, didConnectToFlashnet: null }
          : {
              balance: 0,
              tokens: {},
              transactions: [],
              identityPubKey: '',
              sparkAddress: '',
              didConnect: null,
              didConnectToFlashnet: null,
            },
      );
      contactsPrivateKeyRef.current = '';
      contactsPublicKeyRef.current = null;
      clearSpendAndReplaceCorrelationMemo();
      if (!internalRefresh) {
        setDidRunNormalConnection(false);
        setNormalConnectionTimeout(false);
        currentMnemonicRef.current = null;
        mainWalletHashRef.current = null;
        setTokensImageCache({});
      }
    },
    [],
  );

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    resetSparkState();
  }, [authResetkey]);

  useEffect(() => {
    contactsPrivateKeyRef.current = contactsPrivateKey;
    contactsPublicKeyRef.current = publicKey;
  }, [contactsPrivateKey, publicKey]);

  // Register a stable getter so transaction writes can snapshot the centralized
  // auth keys without storing key material in module scope or changing every
  // bulkUpdateSparkTransactions call site.
  useEffect(() => {
    setSpendAndReplaceAuthGetter(() => ({
      privateKey: contactsPrivateKeyRef.current,
      publicKey: contactsPublicKeyRef.current,
    }));
    return () => setSpendAndReplaceAuthGetter(null);
  }, []);

  // Add event listeners to listen for bitcoin and lightning or spark transfers when receiving only when screen is active
  useEffect(() => {
    // Handle immediate background transitions synchronously(background events on android were not running)
    if (prevAppState.current !== appState && appState === 'background') {
      console.log('App moved to background — clearing listener type');
      prevListenerType.current = null;
    }

    const timeoutId = setTimeout(async () => {
      if (!didGetToHomepage) return;
      if (!sparkInfoRef.current.identityPubKey) return;

      const getListenerType = () => {
        if (appState === 'active') return 'full';
        return null;
      };

      const newType = getListenerType();
      const prevType = prevListenerType.current;
      const prevId = prevAccountId.current;

      // Only reconfigure listeners when becoming active, and only while the
      // wallet is connected (a WebView reload is re-attached once it is back).
      let reattached = false;
      if (
        (newType !== prevType ||
          prevId !== sparkInfoRef.current.identityPubKey) &&
        appState === 'active' &&
        sparkInformation.didConnect
      ) {
        await removeListeners(false);
        // Leave prevListenerType null if the attach failed so the next
        // foreground/account change re-attempts instead of assuming listeners
        // are live.
        const attached = newType ? await addListeners(newType) : true;
        prevListenerType.current = attached ? newType : null;
        prevAccountId.current = sparkInfoRef.current.identityPubKey;
        reattached = true;
      }

      // One authoritative read once listeners are live (connect, reload,
      // runtime switch, foreground): anything missed before this point lands,
      // and nothing after it can be missed. Skipped mid-send; the engine
      // lands held events when the send ends.
      if (
        appState === 'active' &&
        (reattached || prevAppState.current !== 'active')
      ) {
        getBalanceEngine().settle();
      }

      // Reconcile pending txs on every foreground transition, independent of the
      // addListeners re-arm above — if that bailed (AppState race / listener
      // lock) the 10s interval never gets recreated, and this is the only thing
      // that then completes a stuck send without a full app restart. The
      // single-flight latch dedupes the double-call on a successful re-arm.
      if (appState === 'active' && prevAppState.current !== 'active') {
        const response = await updateSparkTxStatus(
          currentMnemonicRef.current,
          sparkInfoRef.current.identityPubKey,
          false,
          contactsPrivateKeyRef.current,
          contactsPublicKeyRef.current,
        );
        // Same drift backstop as the 10s interval: foregrounding recovers a
        // stuck send without a full app restart even if the interval never
        // re-armed (AppState race / listener lock).
        if (
          Array.isArray(response?.pendingIds) &&
          hasPendingTxDrift(
            sparkInfoRef.current.transactions,
            response.pendingIds,
          )
        ) {
          sparkTransactionsEventEmitter.emit(
            SPARK_TX_UPDATE_ENVENT_NAME,
            'transactions',
          );
        }
      }

      prevAppState.current = appState;
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    appState,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    didGetToHomepage,
    // isSendingPayment,
  ]);

  useEffect(() => {
    if (!didGetToHomepage) return;
    if (!sparkInformation.didConnect) return;
    if (!sparkInformation.identityPubKey) return;

    // Interval to check deposit addresses to see if they were paid
    const handleDepositAddressCheck = async () => {
      try {
        console.log('l1Deposit check running....');
        if (AppState.currentState !== 'active') return;
        if (isSendingPaymentRef.current) return;
        if (!currentMnemonicRef.current) return;

        // Identity-scoped detection: one sweep returns every deposit UTXO the
        // identity owns across ALL of its static deposit addresses, so a
        // deposit is claimable even when queryStaticDepositAddresses does not
        // list its address (the address-enumeration miss that left deposits
        // stuck.
        const unclaimedUtxos = await fetchAllIdentityDepositUtxos(
          currentMnemonicRef.current,
          true,
        );

        if (!unclaimedUtxos.didWork || !unclaimedUtxos.utxos.length) return;

        // Claim pass: each identity UTXO carries the address it paid to.
        for (const utxo of unclaimedUtxos.utxos) {
          const { txid, vout, address, isConfirmed } = utxo;

          // Claim the UTXO (quote → SSP claim → settle check → persist).
          const outcome = await claimDepositUtxo({
            txid,
            vout,
            address,
            mnemonic: currentMnemonicRef.current,
            identityPubKey: sparkInfoRef.current.identityPubKey,
            isConfirmed,
          });

          if (!outcome.didClaim) {
            console.log('Claim static deposit address error', outcome.error);
            continue;
          }

          // Mark the transfer as handled so transferHandler skips it ONLY
          // once the row is persisted. The SDK fires a transfer:claimed
          // event for this claim, and without the guard,
          // debouncedHandleIncomingPayment would write a placeholder record
          // that races our own bulkUpdateSparkTransactions call. If the row
          // could not be persisted, keep the event path enabled — it is the
          // remaining writer for that transfer.
          if (outcome.persisted) {
            handledTransfers.current.add(outcome.transferId);
          } else {
            console.error(
              'Claimed deposit but failed to persist transaction; transfer event path stays enabled',
              outcome.transferId,
            );
          }

          console.log(
            'Claimed deposit address transaction:',
            outcome.transferId,
          );
          console.log('Updated bitcoin transaction:', outcome.updatedTx);

          // Navigate to confirm screen if we have details
          if (outcome.updatedTx.details) {
            if (handledNavigatedTxs.current.has(outcome.updatedTx.id)) {
              continue;
            }
            handledNavigatedTxs.current.add(outcome.updatedTx.id);
            if (!isOnSendScreen()) {
              showToast({
                amount: outcome.updatedTx.details.amount,
                duration: 7000,
                type: 'confirmTx',
              });
            }
          }
        }
      } catch (err) {
        console.log('Handle deposit address check error', err);
      }
    };

    clearAllDepositIntervals();

    if (depositAddressIntervalRef.current) {
      clearInterval(depositAddressIntervalRef.current);
      depositAddressIntervalRef.current = null;
    }

    if (!initialBitcoinIntervalRun.current) {
      setTimeout(handleDepositAddressCheck, 1_000 * 5);
      initialBitcoinIntervalRun.current = true;
    }

    const depositIntervalId = setInterval(
      handleDepositAddressCheck,
      1_000 * 60,
    );

    depositAddressIntervalRef.current = depositIntervalId;
    depositIntervalIds.add(depositIntervalId);

    return () => {
      console.log('Cleaning up deposit interval on unmount/dependency change');
      if (depositIntervalId) {
        clearInterval(depositIntervalId);
        depositIntervalIds.delete(depositIntervalId);
      }
      if (depositAddressIntervalRef.current) {
        clearInterval(depositAddressIntervalRef.current);
        depositAddressIntervalRef.current = null;
      }
    };
  }, [
    sparkInformation.didConnect,
    didGetToHomepage,
    sparkInformation.identityPubKey,
    showToast,
  ]);

  // On background a balance read can't settle (the WebView request timeout is
  // neutered), so any read in flight is voided; the attach
  // effect reads again once the app is active and listeners are live.
  useEffect(() => {
    const prev = foregroundReconcileAppStateRef.current;
    foregroundReconcileAppStateRef.current = appState;
    if (appState === 'background') {
      engineRef.current?.invalidate();
      return;
    }

    if (appState !== 'active' || prev === 'active') return;
    if (!sparkInformation.didConnect) return;
    if (!sparkInformation.identityPubKey) return;

    // Refresh the local leaves store on foreground (throttled).
    reconcileLeaves();
    // Recover token txs whose token-balance:update fired while backgrounded.
    reconcileTokenTransactions(false);
  }, [
    appState,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    reconcileLeaves,
    reconcileTokenTransactions,
  ]);

  // On the first successful connect for an account: hydrate the leaves summary
  // from the local SQLite store (so the Wallet Leaves page has cached totals
  // immediately, even offline), then kick off one forced sync to freshen it.
  useEffect(() => {
    if (!sparkInformation.didConnect) return;
    if (!sparkInformation.identityPubKey) return;
    if (hydratedLeavesForRef.current === sparkInformation.identityPubKey)
      return;
    hydratedLeavesForRef.current = sparkInformation.identityPubKey;

    const identityPubKey = sparkInformation.identityPubKey;
    (async () => {
      try {
        const stats = await getGlobalLeafStats(identityPubKey);
        setSparkInformation(prev => ({
          ...prev,
          leaves: {
            ...(prev.leaves || {}),
            count: stats.totalLeaves,
            totalValue: stats.totalValue,
            lastSyncedAt: stats.lastSyncedAt,
          },
        }));
      } catch (err) {
        console.log('hydrate leaves summary error', err);
      }
      reconcileLeaves(true);
    })();
  }, [
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    reconcileLeaves,
  ]);

  // This function connects to the spark node and sets the session up

  const connectToSparkWallet = useCallback(
    async identityPubKey => {
      // A connect outlived by a logout must not write the old wallet back,
      // and its slow read (up to 10 s) must not overwrite a newer balance the
      // engine committed meanwhile.
      const startAuthKey = authResetKeyRef.current;
      const startVersion = getBalanceEngine().version();
      const setIfCurrent = update =>
        setSparkInformation(prev => {
          if (authResetKeyRef.current !== startAuthKey) return prev;
          const next = typeof update === 'function' ? update(prev) : update;
          if (getBalanceEngine().version() === startVersion) return next;
          return { ...next, balance: prev.balance, tokens: prev.tokens };
        });
      const { didWork, error } = await initWallet({
        setSparkInformation: setIfCurrent,
        filterAndSetTransactions: txs => {
          if (authResetKeyRef.current === startAuthKey) {
            filterAndSetTransactions(txs);
          }
        },
        // toggleGlobalContactsInformation,
        // globalContactsInformation,
        mnemonic: currentMnemonicRef.current || currentWalletMnemoinc,
        // Restore now runs solely via createRestorePoller in addListeners, so
        // always load cached txs on connect (the poller's SPARK_TX events layer
        // in any newly restored txs afterward).
        hasRestoreCompleted: false,
        identityPubKey,
      });
      if (authResetKeyRef.current !== startAuthKey) return;
      setDidRunNormalConnection(true);
      // lastConnectedTimeRef.current = Date.now();
      if (!didWork) {
        setSparkInformation(prev => ({ ...prev, didConnect: false }));
        setSparkConnectionError(error);
        console.log('Error connecting to spark wallet:', error);
      }
      // A timed-out connect read left the snapshot on screen; the read the
      // attach effect runs once listeners are live lands the real balance.
    },
    [currentWalletMnemoinc],
  );

  // Function to update db when all reqiured information is loaded
  useEffect(() => {
    if (!sparkInformation.didConnect) return;
    if (!globalContactsInformation?.myProfile) return;
    if (!sparkInformation.identityPubKey) return;
    if (!sparkInformation.sparkAddress) return;

    if (sparkDBaddress.current) return;
    sparkDBaddress.current = true;

    if (
      !globalContactsInformation.myProfile.sparkAddress ||
      !globalContactsInformation.myProfile.sparkIdentityPubKey
    ) {
      toggleGlobalContactsInformation(
        {
          myProfile: {
            ...globalContactsInformation.myProfile,
            sparkAddress: sparkInformation.sparkAddress,
            sparkIdentityPubKey: sparkInformation.identityPubKey,
          },
        },
        true,
      );
    }
  }, [
    globalContactsInformation.myProfile,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
    sparkInformation.sparkAddress,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      engineRef.current?.dispose();
      clearCommitRestore();
      clearTimeout(sendingFlagTimerRef.current);
      if (tokenDebounceTimeoutRef.current) {
        clearTimeout(tokenDebounceTimeoutRef.current);
      }
      if (tokenDebounceMaxWaitRef.current) {
        clearTimeout(tokenDebounceMaxWaitRef.current);
      }
      clearIncomingRetries();
      pendingTransferIds.current.clear();
    };
  }, []);

  const txsHashKey = useMemo(
    () =>
      sparkInformation.transactions
        .filter(tx => tx.paymentStatus === 'completed')
        .map(tx => tx.sparkID)
        .join(','),
    [sparkInformation.transactions],
  );

  const contextValue = useMemo(
    () => ({
      sparkInformation,
      txsHashKey,
      setSparkInformation,
      // numberOfCachedTxs,
      // setNumberOfCachedTxs,
      connectToSparkWallet,
      sparkConnectionError,
      setSparkConnectionError,
      tokensImageCache,
      showTokensInformation,
      isSendingPaymentRef,
      sparkInfoRef,
      updateHomepageScrollPosition,
      filterAndSetTransactions,
      updateHomepageTxPreferance,
      reconcileLeaves,
      reconcileExitNodes,
    }),
    [
      sparkInformation,
      txsHashKey,
      setSparkInformation,
      // numberOfCachedTxs,
      // setNumberOfCachedTxs,
      connectToSparkWallet,
      sparkConnectionError,
      setSparkConnectionError,
      tokensImageCache,
      showTokensInformation,
      isSendingPaymentRef,
      sparkInfoRef,
      updateHomepageScrollPosition,
      filterAndSetTransactions,
      updateHomepageTxPreferance,
      reconcileLeaves,
      reconcileExitNodes,
    ],
  );

  return (
    <SparkWalletManager.Provider value={contextValue}>
      {children}
    </SparkWalletManager.Provider>
  );
};

function useSparkWallet() {
  const context = useContext(SparkWalletManager);
  if (!context) {
    throw new Error('useSparkWallet must be used within a SparkWalletProvider');
  }
  return context;
}

export { SparkWalletManager, SparkWalletProvider, useSparkWallet };
