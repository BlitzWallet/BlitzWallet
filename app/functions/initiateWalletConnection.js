import { crashlyticsLogReport } from './crashlyticsLogs';
import {
  getCachedSparkTransactions,
  getSparkAddress,
  getSparkBalance,
  getSparkIdentityPubKey,
  initializeFlashnet,
  initializeSparkWallet,
  setPrivacyEnabled,
} from './spark';
import { cleanStalePendingSparkLightningTransactions } from './spark/transactions';

export async function initWallet({
  setSparkInformation,
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
      }));
      const didSetSpark = await initializeSparkSession({
        setSparkInformation,
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
  mnemonic,
  sendWebViewRequest,
  hasRestoreCompleted,
  identityPubKey: cachedIdentityPubKey,
}) {
  try {
    // Fire immediately — never blocks the critical path
    cleanStalePendingSparkLightningTransactions();

    // If we already have the identity key, we can fetch cached txs right now
    // in parallel with the other spark calls — otherwise it has to wait
    const txsPromise = cachedIdentityPubKey
      ? getCachedSparkTransactions(null, cachedIdentityPubKey)
      : null;

    const [balance, sparkAddress, freshIdentityPubKey] = await Promise.all([
      getSparkBalance(mnemonic),
      getSparkAddress(mnemonic),
      cachedIdentityPubKey
        ? Promise.resolve(cachedIdentityPubKey)
        : getSparkIdentityPubKey(mnemonic),
    ]);

    // Resolve txs: if we pre-fetched use that, otherwise fetch now with fresh key
    const transactions = await (txsPromise ??
      getCachedSparkTransactions(null, freshIdentityPubKey));

    if (transactions === undefined)
      throw new Error('Unable to initialize spark from history');

    // Fire and forget — non-blocking
    setPrivacyEnabled(mnemonic);

    const identityPubKey = freshIdentityPubKey;

    if (!balance.didWork) {
      const storageObject = {
        transactions,
        identityPubKey,
        sparkAddress: sparkAddress.response,
        didConnect: true,
      };
      setSparkInformation(prev => ({ ...prev, ...storageObject }));
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

    setSparkInformation(prev => {
      const txToUse =
        !hasRestoreCompleted ||
        (prev.identityPubKey && prev.identityPubKey !== identityPubKey)
          ? transactions
          : prev.transactions;

      return { ...prev, ...storageObject, transactions: txToUse };
    });
    return storageObject;
  } catch (err) {
    console.log('Set spark error', err);
    return false;
  }
}
