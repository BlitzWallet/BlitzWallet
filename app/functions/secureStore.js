import * as SecureStore from 'expo-secure-store';
import {
  getLocalStorageItem,
  removeAllLocalData,
  setLocalStorageItem,
} from './localStorage';
import {crashlyticsLogReport} from './crashlyticsLogs';
import {BIOMETRIC_KEY} from '../constants';
const keychainService = '38WX44YTA6.com.blitzwallet.SharedKeychain';
export const MIGRATION_FLAG = 'secureStoreMigrationComplete';
export const SECURE_MIGRATION_V2_FLAG = 'secureStoreMigrationV2Complete';

const KEYCHAIN_OPTION = {
  keychainService: keychainService,
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function storeData(key, value, options = {}) {
  try {
    crashlyticsLogReport('Starting store data to secure store function');
    await SecureStore.setItemAsync(key, value, {
      ...KEYCHAIN_OPTION,
      ...options,
    });
    return true;
  } catch (error) {
    console.log(error, 'SECURE STORE ERROR');
    return false;
  }
}

async function retrieveData(key, options = {}) {
  try {
    crashlyticsLogReport('Starting retrive data from secure store function');

    const value = await SecureStore.getItemAsync(key, {
      ...KEYCHAIN_OPTION,
      ...options,
    });

    return {didWork: true, value};
  } catch (error) {
    console.log('Error storing data to secure store', error);
    return {didWork: false, value: false};
  }
}

async function terminateAccount() {
  try {
    crashlyticsLogReport('Starting termiate data from secure store function');
    await SecureStore.deleteItemAsync('pinHash', KEYCHAIN_OPTION);
    await SecureStore.deleteItemAsync('encryptedMnemonic', KEYCHAIN_OPTION);
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY, KEYCHAIN_OPTION);

    const didRemove = await removeAllLocalData();
    if (!didRemove) throw Error('not able to remove local storage data');

    return true;
  } catch (error) {
    return false;
  }
}

async function deleteItem(key) {
  try {
    crashlyticsLogReport('Starting delte item from secure store function');
    await SecureStore.deleteItemAsync(key, KEYCHAIN_OPTION);

    return true;
  } catch (error) {
    console.log('Error deleating item in secure store', error);
    return false;
  }
}

async function runPinAndMnemoicMigration() {
  try {
    const hasMigrated = await getLocalStorageItem(MIGRATION_FLAG);
    if (hasMigrated === 'true') {
      crashlyticsLogReport('SecureStore migration already completed');
      return;
    }

    crashlyticsLogReport('Running SecureStore migration');

    const [oldPin, oldMnemonic] = await Promise.all([
      SecureStore.getItemAsync('pin'),
      SecureStore.getItemAsync('mnemonic'),
    ]);

    if (oldPin || oldMnemonic) {
      if (oldPin) await storeData('pinHash', oldPin);
      if (oldMnemonic) await storeData('encryptedMnemonic', oldMnemonic);
      await SecureStore.deleteItemAsync('pin');
      await SecureStore.deleteItemAsync('mnemonic');
    }

    await setLocalStorageItem(MIGRATION_FLAG, 'true');
    crashlyticsLogReport('SecureStore migration completed successfully');
  } catch (error) {
    console.log('SECURE STORE MIGRATION ERROR:', error);
  }
}

async function runSecureStoreMigrationV2() {
  try {
    const hasMigrated = await getLocalStorageItem(SECURE_MIGRATION_V2_FLAG);
    if (hasMigrated === 'true') {
      crashlyticsLogReport('V2 SecureStore migration already completed');
      return;
    }

    crashlyticsLogReport('Running V2 SecureStore migration');

    // Get unencrypted PIN and mnemonic (possibly migrated from old V1 already)
    const [plainPin, plainMnemonic] = await Promise.all([
      SecureStore.getItemAsync('pin', KEYCHAIN_OPTION),
      SecureStore.getItemAsync('mnemonic', KEYCHAIN_OPTION),
    ]);

    if (plainPin && plainMnemonic) {
      await storeData('pinHash', plainPin);
      await storeData('encryptedMnemonic', plainMnemonic);

      // Delete old unencrypted values
      await deleteItem('pin');
      await deleteItem('mnemonic');
    }

    await setLocalStorageItem(SECURE_MIGRATION_V2_FLAG, 'true');
    crashlyticsLogReport('V2 SecureStore migration completed');
  } catch (error) {
    console.log('SecureStore Migration V2 Error:', error);
  }
}

export {
  retrieveData,
  storeData,
  terminateAccount,
  deleteItem,
  runPinAndMnemoicMigration,
  runSecureStoreMigrationV2,
};
