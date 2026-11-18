import { crashlyticsLogReport } from './crashlyticsLogs';
import {
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
  // toggleGlobalContactsInformation,
  // globalContactsInformation,
  mnemonic,
  identityPubKey,
}) {
  try {
    crashlyticsLogReport('Trying to connect to nodes');
    const didConnectToSpark = await initializeSparkWallet(mnemonic);

    let balanceTimedOut = false;
    if (didConnectToSpark.isConnected) {
      crashlyticsLogReport('Loading node balances for session');
      setSparkInformation(prev => ({
        ...prev,
        didConnect: true,
        ...(identityPubKey ? { identityPubKey } : {}),
      }));
      const didSetSpark = await initializeSparkSession({
        setSparkInformation,
        // globalContactsInformation,
        // toggleGlobalContactsInformation,
        mnemonic,
        identityPubKey,
      });

      if (!didSetSpark)
        throw new Error(
          'We were unable to connect to the spark node. Please try again.',
        );
      balanceTimedOut = !!didSetSpark.balanceTimedOut;
    } else {
      throw new Error(
        didConnectToSpark.error ||
          'We were unable to connect to the spark node. Please try again.',
      );
    }
    return { didWork: true, balanceTimedOut };
  } catch (err) {
    console.log('initialize spark wallet error main', err);
    return { didWork: false, error: err.message };
  }
}

export async function initializeSparkSession({
  setSparkInformation,
  mnemonic,
  identityPubKey: cachedIdentityPubKey,
}) {
  try {
    // Fire immediately — never blocks the critical path
    cleanStalePendingSparkLightningTransactions();

    // Returning users (a cached snapshot exists): the loading screen already
    // painted it, and sparkContext reads the live balance once its listeners
    // are attached, so nothing between that read and the listeners can be
    // missed. Reading here too would only delay the connect. First logins
    // (no snapshot) read now so the homepage opens on a real balance.
    let skipBalanceFetch = false;
    let balanceSnapshot = {};
    if (cachedIdentityPubKey) {
      balanceSnapshot = await getAccountBalanceSnapshot(cachedIdentityPubKey);
      skipBalanceFetch = balanceSnapshot !== null;
    }
    const [balance, sparkAddress, freshIdentityPubKey] = await Promise.all([
      skipBalanceFetch ? null : getBalanceWithTimeout(mnemonic, 10000),
      getSparkAddress(mnemonic, cachedIdentityPubKey),
      cachedIdentityPubKey
        ? Promise.resolve(cachedIdentityPubKey)
        : getSparkIdentityPubKey(mnemonic),
    ]);

    // Fire and forget — non-blocking
    setPrivacyEnabled(mnemonic, freshIdentityPubKey);

    const identityPubKey = freshIdentityPubKey;

    if (!balance?.didWork) {
      const storageObject = {
        identityPubKey,
        sparkAddress: sparkAddress.response,
        // The loading screen owns the snapshot paint when it exists.
        ...(skipBalanceFetch ? {} : balanceSnapshot ?? {}),
        didConnect: true,
      };
      setSparkInformation(prev => ({
        ...prev,
        ...storageObject,
      }));
      // Signal a skipped/timed-out read so the caller knows the balance is
      // not fresh. Not spread into state — only the clean storageObject is.
      return { ...storageObject, balanceTimedOut: true };
    }

    const storageObject = {
      balance: Number(balance.balance),
      tokens: balance.tokensObj,
      identityPubKey,
      sparkAddress: sparkAddress.response,
      didConnect: true,
      initialBalance: Number(balance.balance),
    };

    setSparkInformation(prev => ({ ...prev, ...storageObject }));
    return storageObject;
  } catch (err) {
    console.log('Set spark error', err);
    return false;
  }
}
