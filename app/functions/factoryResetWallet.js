import { terminateAccount } from './secureStore';
import { signOut } from '@react-native-firebase/auth';
import { firebaseAuth } from '../../db/initializeFirebase';
import { deleteAllLocalWalletTables } from './wipeLocalWalletData';

export default async function factoryResetWallet() {
  try {
    const didTerminate = await terminateAccount();
    if (!didTerminate) throw new Error('Did not terminate');

    const didDeleteTables = await deleteAllLocalWalletTables();
    if (!didDeleteTables) throw new Error('Did not delete tables');

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
