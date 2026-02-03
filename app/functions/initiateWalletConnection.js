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
import handleBalanceCache from './spark/handleBalanceCache';
import { cleanStalePendingSparkLightningTransactions } from './spark/transactions';

export async function initWallet({
  setSparkInformation,
  // toggleGlobalContactsInformation,
  // globalContactsInformation,
  mnemonic,
  sendWebViewRequest,
  hasRestoreCompleted = true,
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
  // globalContactsInformation,
  // toggleGlobalContactsInformation,
  mnemonic,
  sendWebViewRequest,
  hasRestoreCompleted,
}) {
  try {
    // Clean DB state but do not hold up process
    cleanStalePendingSparkLightningTransactions();
    const [balance, sparkAddress, identityPubKey, flashnetResponse] =
      await Promise.all([
        getSparkBalance(mnemonic),
        getSparkAddress(mnemonic),
        getSparkIdentityPubKey(mnemonic),
        initializeFlashnet(mnemonic),
      ]);

    setPrivacyEnabled(mnemonic);
    const transactions = await getCachedSparkTransactions(null, identityPubKey);

    if (transactions === undefined)
      throw new Error('Unable to initialize spark from history');

    if (!balance.didWork) {
      const storageObject = {
        transactions: transactions,
        identityPubKey,
        sparkAddress: sparkAddress.response,
        didConnect: true,
        didConnectToFlashnet: flashnetResponse,
      };
      await new Promise(res => setTimeout(res, 500));
      setSparkInformation(prev => ({ ...prev, ...storageObject }));
      return storageObject;
    }

    // if (
    //   !globalContactsInformation.myProfile.sparkAddress ||
    //   !globalContactsInformation.myProfile.sparkIdentityPubKey
    // ) {
    //   toggleGlobalContactsInformation(
    //     {
    //       myProfile: {
    //         ...globalContactsInformation.myProfile,
    //         sparkAddress: sparkAddress,
    //         sparkIdentityPubKey: identityPubKey,
    //       },
    //     },
    //     true,
    //   );
    // }

    // Get cached balance from last session to use as placeholder while polling confirms the real balance
    const cachedBalance = await handleBalanceCache({
      returnBalanceOnly: true,
      mnemonic,
    });

    // Use cached balance as placeholder; polling in sparkContext will confirm the real balance
    const placeholderBalance =
      cachedBalance != null && cachedBalance > 0
        ? cachedBalance
        : Number(balance.balance);

    const storageObject = {
      balance: placeholderBalance,
      tokens: balance.tokensObj,
      identityPubKey,
      sparkAddress: sparkAddress.response,
      didConnect: true,
      didConnectToFlashnet: flashnetResponse,
      initialBalance: Number(balance.balance),
    };
    console.log('Spark storage object', storageObject);
    await new Promise(res => setTimeout(res, 500));
    setSparkInformation(prev => {
      let txToUse;

      // Restore has not run yet:
      if (
        !hasRestoreCompleted ||
        (prev.identityPubKey && prev.identityPubKey !== identityPubKey)
      ) {
        // We show cached transactions immediately to avoid blanks.
        // But DO NOT overwrite later once restore writes.
        // Fully overwrite if identityPubKey changed (new wallet).
        txToUse = transactions;
      } else {
        // Restore has finished:
        // Never insert fetchedTransactions (they may be stale)
        // Use whatever DB restore already put in state.
        txToUse = prev.transactions;
      }

      return {
        ...prev,
        ...storageObject,
        transactions: txToUse,
      };
    });
    return storageObject;
  } catch (err) {
    console.log('Set spark error', err);
    return false;
  }
}
