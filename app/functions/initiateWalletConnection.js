import { crashlyticsLogReport } from './crashlyticsLogs';
import {
  getCachedSparkTransactions,
  getSparkAddress,
  getSparkIdentityPubKey,
  initializeSparkWallet,
  setPrivacyEnabled,
} from './spark';
import { cleanStalePendingSparkLightningTransactions } from './spark/transactions';
import { getAccountBalanceSnapshot } from './spark/balanceSnapshots';
import { getBalanceWithTimeout } from './pollingManager';

export async function initWallet({
  setSparkInformation,
  filterAndSetTransactions,
  // toggleGlobalContactsInformation,
  // globalContactsInformation,
  mnemonic,
  sendWebViewRequest,
  hasRestoreCompleted = true,
  identityPubKey,
}) {
  try {
    crashlyticsLogReport('Trying to connect to nodes');
    const didConnectToSpark = await initializeSparkWallet(mnemonic);

    if (didConnectToSpark.isConnected) {
      crashlyticsLogReport('Loading node balances for session');
      setSparkInformation(prev => ({
        ...prev,
        didConnect: true,
        ...(identityPubKey ? { identityPubKey } : {}),
      }));
      const didSetSpark = await initializeSparkSession({
        setSparkInformation,
        filterAndSetTransactions,
        // globalContactsInformation,
        // toggleGlobalContactsInformation,
        mnemonic,
        sendWebViewRequest,
        hasRestoreCompleted,
        identityPubKey,
      });

      if (!didSetSpark)
        throw new Error(
          'We were unable to connect to the spark node. Please try again.',
        );
    } else {
      throw new Error(
        didConnectToSpark.error ||
          'We were unable to connect to the spark node. Please try again.',
      );
    }
    return { didWork: true };
  } catch (err) {
    console.log('initialize spark wallet error main', err);
    return { didWork: false, error: err.message };
  }
}

export async function initializeSparkSession({
  setSparkInformation,
  filterAndSetTransactions,
  mnemonic,
  sendWebViewRequest,
  hasRestoreCompleted,
  identityPubKey: cachedIdentityPubKey,
}) {
  try {
    // Fire immediately — never blocks the critical path
    cleanStalePendingSparkLightningTransactions();

    // Always fetch a live balance on connect. The cached snapshot is already
    // painted by the loading screen for instant first-paint, but returning
    // users must still get an authoritative read so a stale snapshot can never
    // persist until a manual pull-to-refresh.
    let skipBalanceFetch = false;
    let balanceSnapshot = {};
    if (cachedIdentityPubKey) {
      balanceSnapshot = await getAccountBalanceSnapshot(cachedIdentityPubKey);
      skipBalanceFetch = balanceSnapshot !== null;
    }
    // Only fetch fresh txs when restoring — returning users keep prev.transactions
    const needsFreshTxs = !hasRestoreCompleted;
    const txsPromise =
      needsFreshTxs && cachedIdentityPubKey
        ? getCachedSparkTransactions(null, cachedIdentityPubKey)
        : null;

    const [balance, sparkAddress, freshIdentityPubKey] = await Promise.all([
      skipBalanceFetch
        ? Promise.resolve({ didWork: false })
        : getBalanceWithTimeout(mnemonic, 10000),
      getSparkAddress(mnemonic),
      cachedIdentityPubKey
        ? Promise.resolve(cachedIdentityPubKey)
        : getSparkIdentityPubKey(mnemonic),
    ]);

    // Resolve txs: pre-fetched, or fetch now with fresh key, or null for returning users
    const transactions = await (txsPromise ??
      (needsFreshTxs
        ? getCachedSparkTransactions(null, freshIdentityPubKey)
        : null));

    if (transactions === undefined)
      throw new Error('Unable to initialize spark from history');

    // Fire and forget — non-blocking
    setPrivacyEnabled(mnemonic, freshIdentityPubKey);

    const identityPubKey = freshIdentityPubKey;

    if (!balance.didWork) {
      const storageObject = {
        identityPubKey,
        sparkAddress: sparkAddress.response,
        ...(balanceSnapshot ?? {}),
        didConnect: true,
      };
      setSparkInformation(prev => ({
        ...prev,
        ...storageObject,
      }));
      const txToUse = transactions ?? [];
      if (txToUse.length && filterAndSetTransactions)
        filterAndSetTransactions(txToUse);
      return storageObject;
    }

    const storageObject = {
      balance: Number(balance.balance),
      tokens: balance.tokensObj,
      identityPubKey,
      sparkAddress: sparkAddress.response,
      didConnect: true,
      initialBalance: Number(balance.balance),
    };

    const txToUse =
      !hasRestoreCompleted ||
      (cachedIdentityPubKey && cachedIdentityPubKey !== identityPubKey)
        ? transactions
        : null;

    setSparkInformation(prev => ({ ...prev, ...storageObject }));
    if (txToUse && filterAndSetTransactions) filterAndSetTransactions(txToUse);
    return storageObject;
  } catch (err) {
    console.log('Set spark error', err);
    return false;
  }
}
