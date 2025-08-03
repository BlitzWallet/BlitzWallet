import {crashlyticsLogReport} from './crashlyticsLogs';
import {
  getCachedSparkTransactions,
  getSparkAddress,
  getSparkBalance,
  getSparkIdentityPubKey,
  initializeSparkWallet,
} from './spark';
import handleBalanceCache from './spark/handleBalanceCache';

import {cleanStalePendingSparkLightningTransactions} from './spark/transactions';

export async function initWallet({
  setSparkInformation,
  // toggleGlobalContactsInformation,
  // globalContactsInformation,
  mnemonic,
}) {
  try {
    crashlyticsLogReport('Trying to connect to nodes');
    const didConnectToSpark = await initializeSparkWallet(mnemonic);

    if (didConnectToSpark.isConnected) {
      crashlyticsLogReport('Loading node balances for session');
      const didSetSpark = await initializeSparkSession({
        setSparkInformation,
        // globalContactsInformation,
        // toggleGlobalContactsInformation,
      });

      if (!didSetSpark)
        throw new Error(
          'Spark wallet information was not set properly, please try again.',
        );
    } else {
      throw new Error(
        didConnectToSpark.error ||
          'We were unable to connect to the spark node. Please try again.',
      );
    }
    return {didWork: true};
  } catch (err) {
    console.log('initialize spark wallet error', err);
    crashlyticsLogReport(err.message);
    return {didWork: false, error: err.message};
  }
}

async function initializeSparkSession({
  setSparkInformation,
  // globalContactsInformation,
  // toggleGlobalContactsInformation,
}) {
  try {
    // Clean DB state but do not hold up process
    cleanStalePendingSparkLightningTransactions();
    const [balance, transactions, sparkAddress, identityPubKey] =
      await Promise.all([
        getSparkBalance(),
        getCachedSparkTransactions(),
        getSparkAddress(),
        getSparkIdentityPubKey(),
      ]);

    if (!balance.didWork || transactions === undefined)
      throw new Error('Unable to initialize spark from history');

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

    let didLoadCorrectBalance = false;
    let runCount = 0;
    let maxRunCount = 5;
    let initialBalanceResponse = balance;
    let correctBalance = 0;

    while (runCount < maxRunCount && !didLoadCorrectBalance) {
      runCount += 1;
      let currentBalance = 0;

      if (runCount === 1) {
        currentBalance = Number(initialBalanceResponse.balance);
      } else {
        const retryResponse = await getSparkBalance();
        currentBalance = Number(retryResponse.balance);
      }

      const response = await handleBalanceCache({
        isCheck: true,
        passedBalance: currentBalance,
      });

      if (response.didWork) {
        correctBalance = response.balance;
        didLoadCorrectBalance = true;
      } else {
        console.log('Waiting for correct balance resposne');
        await new Promise(res => setTimeout(res, 2000));
      }
    }

    const finalBalanceToUse = didLoadCorrectBalance
      ? correctBalance
      : Number(initialBalanceResponse.balance);
    console.log(
      didLoadCorrectBalance,
      runCount,
      initialBalanceResponse,
      correctBalance,
      finalBalanceToUse,
      'balancasldfkjasdlfkjasdf',
    );
    if (!didLoadCorrectBalance) {
      await handleBalanceCache({
        isCheck: false,
        passedBalance: finalBalanceToUse,
      });
    }
    const storageObject = {
      balance: finalBalanceToUse,
      tokens: balance.tokensObj,
      transactions: transactions,
      identityPubKey,
      sparkAddress: sparkAddress.response,
      didConnect: true,
    };
    console.log('Spark storage object', storageObject);
    setSparkInformation(storageObject);
    return storageObject;
  } catch (err) {
    console.log('Set spark error', err);
    return false;
  }
}
