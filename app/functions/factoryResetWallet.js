import {deleteEcashDBTables} from './eCash/db';
import {deleteTable} from './messaging/cachedMessages';
import {deletePOSTransactionsTable} from './pos';
import {terminateAccount} from './secureStore';
import auth from '@react-native-firebase/auth';

export default async function factoryResetWallet() {
  try {
    await deleteTable();
    await deleteEcashDBTables();
    await deletePOSTransactionsTable();
    await terminateAccount();
    try {
      await auth().signOut();
    } catch (err) {
      console.log('reset wallet sign out error', err);
    }
    return true;
  } catch (err) {
    console.log('factory reset error', err);
    return false;
  }
}
