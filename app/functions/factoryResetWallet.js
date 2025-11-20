// import {deleteEcashDBTables} from './eCash/db';
import { deleteTable } from './messaging/cachedMessages';
import { deletePOSTransactionsTable } from './pos';
import { terminateAccount } from './secureStore';
import { signOut } from '@react-native-firebase/auth';
import {
  deleteSparkTransactionTable,
  deleteUnpaidSparkLightningTransactionTable,
} from './spark/transactions';
import { firebaseAuth } from '../../db/initializeFirebase';
import { deleteGiftsTable } from './gift/giftsStorage';

export default async function factoryResetWallet() {
  try {
    await deleteTable();
    // await deleteEcashDBTables();
    await deletePOSTransactionsTable();
    await deleteSparkTransactionTable();
    await deleteUnpaidSparkLightningTransactionTable();
    await deleteGiftsTable();
    await terminateAccount();

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
