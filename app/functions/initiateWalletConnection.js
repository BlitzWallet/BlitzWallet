import { crashlyticsLogReport } from './crashlyticsLogs';
import {
  getCachedSparkTransactions,
  getSparkAddress,
  getSparkBalance,
  getSparkIdentityPubKey,
  initializeSparkWallet,
} from './spark';
import handleBalanceCache from './spark/handleBalanceCache';
import { cleanStalePendingSparkLightningTransactions } from './spark/transactions';

export async function initWallet({
  setSparkInformation,
  // toggleGlobalContactsInformation,
  // globalContactsInformation,
  mnemonic,
  sendWebViewRequest,
}) {
  try {
    crashlyticsLogReport('Trying to connect to nodes');
    const [didConnectToSpark, balance] = await Promise.all([
      initializeSparkWallet(mnemonic),
      handleBalanceCache({
        isCheck: false,
        mnemonic: mnemonic,
        returnBalanceOnly: true,
      }),
    ]);

    if (balance) {
      setSparkInformation(prev => ({
        ...prev,
        didConnect: true,
        balance: balance,
      }));
    }

    if (didConnectToSpark.isConnected) {
      crashlyticsLogReport('Loading node balances for session');
      const didSetSpark = await initializeSparkSession({
        setSparkInformation,
        // globalContactsInformation,
        // toggleGlobalContactsInformation,
        mnemonic,
        sendWebViewRequest,
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
    crashlyticsLogReport(err.message);
    return { didWork: false, error: err.message };
  }
}

export async function initializeSparkSession({
  setSparkInformation,
  // globalContactsInformation,
  // toggleGlobalContactsInformation,
  mnemonic,
  sendWebViewRequest,
}) {
  try {
    // Clean DB state but do not hold up process
    cleanStalePendingSparkLightningTransactions();
    const [balance, sparkAddress, identityPubKey] = await Promise.all([
      getSparkBalance(mnemonic),
      getSparkAddress(mnemonic),
      getSparkIdentityPubKey(mnemonic),
    ]);

    if (!balance.didWork)
      throw new Error('Unable to initialize spark from history');

    const transactions = await getCachedSparkTransactions(null, identityPubKey);

    if (transactions === undefined)
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
    let maxRunCount = 2;
    let initialBalanceResponse = balance;
    let correctBalance = 0;

    while (runCount < maxRunCount && !didLoadCorrectBalance) {
      runCount += 1;
      let currentBalance = 0;

      if (runCount === 1) {
        currentBalance = Number(initialBalanceResponse.balance);
      } else {
        const retryResponse = await getSparkBalance(
          mnemonic,
          sendWebViewRequest,
        );
        currentBalance = Number(retryResponse.balance);
      }

      const response = await handleBalanceCache({
        isCheck: true,
        passedBalance: currentBalance,
        mnemonic,
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
        mnemonic,
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
    await new Promise(res => setTimeout(res, 500));
    setSparkInformation(storageObject);
    return storageObject;
  } catch (err) {
    console.log('Set spark error', err);
    return false;
  }
}
