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
import {
  cleanStalePendingSparkLightningTransactions,
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from './spark/transactions';

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

    // check to see if the balance returnd by spark matched our saved balance
    const response = await handleBalanceCache({
      isCheck: true,
      passedBalance: Number(balance.balance),
      mnemonic,
    });
    console.log(response, 'cached balance resposne');

    // cached balance is not the same as spark returend balance
    if (!response.didWork) {
      sparkTransactionsEventEmitter.emit(
        SPARK_TX_UPDATE_ENVENT_NAME,
        'fullUpdate-waitBalance',
      );
    }

    // let didLoadCorrectBalance = false;
    // let runCount = 0;
    // let maxRunCount = 2;
    // let initialBalanceResponse = balance;
    // let correctBalance = 0;

    // while (runCount < maxRunCount && !didLoadCorrectBalance) {
    //   runCount += 1;
    //   let currentBalance = 0;

    //   if (runCount === 1) {
    //     currentBalance = Number(initialBalanceResponse.balance);
    //   } else {
    //     const retryResponse = await getSparkBalance(
    //       mnemonic,
    //       sendWebViewRequest,
    //     );
    //     currentBalance = Number(retryResponse.balance);
    //   }

    //   const response = await handleBalanceCache({
    //     isCheck: true,
    //     passedBalance: currentBalance,
    //     mnemonic,
    //   });

    //   if (response.didWork) {
    //     correctBalance = response.balance;
    //     didLoadCorrectBalance = true;
    //   } else {
    //     console.log('Waiting for correct balance resposne');
    //     await new Promise(res => setTimeout(res, 2000));
    //   }
    // }

    // const finalBalanceToUse = Number(balance.balance);

    // if (!didLoadCorrectBalance) {
    //   await handleBalanceCache({
    //     isCheck: false,
    //     passedBalance: finalBalanceToUse,
    //     mnemonic,
    //   });
    // }
    const storageObject = {
      balance: Number(balance.balance),
      tokens: balance.tokensObj,
      identityPubKey,
      sparkAddress: sparkAddress.response,
      didConnect: true,
      didConnectToFlashnet: flashnetResponse,
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
