// import {deleteEcashDBTables} from './eCash/db';
import { deleteTable } from './messaging/cachedMessages';
import { deletePOSTransactionsTable } from './pos';
import { terminateAccount } from './secureStore';
import { signOut } from '@react-native-firebase/auth';
import {
  deleteSparkContactsTransactionsTable,
  deleteSparkTransactionTable,
  deleteUnpaidSparkLightningTransactionTable,
} from './spark/transactions';
import { firebaseAuth } from '../../db/initializeFirebase';
import { deleteGiftsTable } from './gift/giftsStorage';
import {
  deletePoolTable,
  deleteContributionsTable,
} from './pools/poolsStorage';
import {
  deleteSavingsGoalsTable,
  deleteSavingsPayoutsTable,
  deleteSavingsTransactionsTable,
} from './savings/savingsStorage';

export default async function factoryResetWallet() {
  try {
    const didTerminate = await terminateAccount();
    if (!didTerminate) throw new Error('Did not terminate');

    await deleteTable();
    // await deleteEcashDBTables();
    await deletePOSTransactionsTable();
    await deleteSparkTransactionTable();
    await deleteUnpaidSparkLightningTransactionTable();
    await deleteSparkContactsTransactionsTable();
    await deleteGiftsTable();
    await deletePoolTable();
    await deleteContributionsTable();
    await deleteSavingsGoalsTable();
    await deleteSavingsTransactionsTable();
    await deleteSavingsPayoutsTable();

    try {
      await signOut(firebaseAuth);
    } catch (err) {
      console.log('reset wallet sign out error', err);
    }
    return true;
  } catch (err) {
    console.log('factory reset error', err);
    return false;
  }
}
