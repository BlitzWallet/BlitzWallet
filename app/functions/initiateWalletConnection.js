import {crashlyticsLogReport} from './crashlyticsLogs';
import {
  getCachedSparkTransactions,
  getSparkAddress,
  getSparkBalance,
  getSparkIdentityPubKey,
  initializeSparkWallet,
} from './spark';

import {cleanStalePendingSparkLightningTransactions} from './spark/transactions';

export async function initWallet({
  setSparkInformation,
  toggleGlobalContactsInformation,
  globalContactsInformation,
  mnemonic,
}) {
  try {
    crashlyticsLogReport('Trying to connect to nodes');
    const didConnectToSpark = await initializeSparkWallet(mnemonic);

    if (didConnectToSpark.isConnected) {
      crashlyticsLogReport('Loading node balances for session');
      const didSetSpark = await initializeSparkSession({
        setSparkInformation,
        globalContactsInformation,
        toggleGlobalContactsInformation,
      });

      if (!didSetSpark)
        throw new Error(
          'Spark wallet information was not set properly, please try again.',
        );
    } else {
      throw new Error(
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
  globalContactsInformation,
  toggleGlobalContactsInformation,
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

    if (balance === undefined || transactions === undefined)
      throw new Error('Unable to initialize spark from history');

    if (
      !globalContactsInformation.myProfile.sparkAddress ||
      !globalContactsInformation.myProfile.sparkIdentityPubKey
    ) {
      toggleGlobalContactsInformation(
        {
          myProfile: {
            ...globalContactsInformation.myProfile,
            sparkAddress: sparkAddress,
            sparkIdentityPubKey: identityPubKey,
          },
        },
        true,
      );
    }
    const storageObject = {
      balance: Number(balance.balance),
      transactions: transactions,
      identityPubKey,
      sparkAddress,
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
