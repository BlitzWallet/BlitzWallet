import {
  getLocalStorageItem,
  removeAllLocalData,
  setLocalStorageItem,
} from './localStorage';
import { crashlyticsLogReport } from './crashlyticsLogs';
import {
  CUSTODY_ACCOUNTS_STORAGE_KEY,
  LOGIN_SECURITY_MODE_TYPE_KEY,
  NWC_SECURE_STORE_KEY,
  NWC_SECURE_STORE_MNEMOINC,
  ROOTSTOCK_SWAP_SIGNER_KEY,
} from '../constants';
import { BIOMETRIC_KEY } from '../constants';
import {
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
} from 'expo-secure-store';
const keychainService = '38WX44YTA6.com.blitzwallet.SharedKeychain';
export const MIGRATION_FLAG = 'secureStoreMigrationComplete';
export const SECURE_MIGRATION_V2_FLAG = 'secureStoreMigrationV2Complete';

const KEYCHAIN_OPTION = {
  keychainService: keychainService,
  keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

async function storeData(key, value, options = {}) {
  try {
    crashlyticsLogReport('Starting store data to secure store function');
    await setItemAsync(key, value, {
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

    const value = await getItemAsync(key, {
      ...KEYCHAIN_OPTION,
      ...options,
    });

    return { didWork: true, value };
  } catch (error) {
    console.log('Error storing data to secure store', error);
    return { didWork: false, value: false };
  }
}

async function terminateAccount() {
  try {
    crashlyticsLogReport('Starting termiate data from secure store function');

    await deleteItemAsync('pinHash', KEYCHAIN_OPTION);
    await deleteItemAsync('encryptedMnemonic', KEYCHAIN_OPTION);
    await deleteItemAsync(BIOMETRIC_KEY, KEYCHAIN_OPTION);
    await deleteItemAsync(CUSTODY_ACCOUNTS_STORAGE_KEY, KEYCHAIN_OPTION);
    await deleteItemAsync(LOGIN_SECURITY_MODE_TYPE_KEY, KEYCHAIN_OPTION);
    await deleteItemAsync(NWC_SECURE_STORE_MNEMOINC, KEYCHAIN_OPTION);
    await deleteItemAsync(NWC_SECURE_STORE_KEY, KEYCHAIN_OPTION);

    const didRemove = await removeAllLocalData();
    if (!didRemove) throw Error('not able to remove local storage data');

    return true;
  } catch (error) {
    return false;
  }
}

async function wipeStaleWalletKeychain() {
  // Deletes the previous wallet's secure-store items during onboarding wipe.
  // Keeps pinHash + encryptedMnemonic — the PIN page just wrote them for the
  // NEW wallet (handleMnemonic.js storeMnemonicWithPinSecurity). Everything
  // else is stale previous-wallet data at wipe-time. deleteItemAsync is a no-op
  // for absent keys, so this is safe on a first-ever install.
  try {
    await Promise.all([
      deleteItemAsync(BIOMETRIC_KEY, KEYCHAIN_OPTION),
      deleteItemAsync(CUSTODY_ACCOUNTS_STORAGE_KEY, KEYCHAIN_OPTION),
      deleteItemAsync(LOGIN_SECURITY_MODE_TYPE_KEY, KEYCHAIN_OPTION),
      deleteItemAsync(NWC_SECURE_STORE_MNEMOINC, KEYCHAIN_OPTION),
      deleteItemAsync(NWC_SECURE_STORE_KEY, KEYCHAIN_OPTION),
      // Legacy pre-migration entries: default service (V1) + KEYCHAIN_OPTION (V2).
      // Removing them stops a re-armed startup migration from clobbering the new
      // encryptedMnemonic/pinHash (Finding 2).
      deleteItemAsync('pin'),
      deleteItemAsync('mnemonic'),
      deleteItemAsync('pin', KEYCHAIN_OPTION),
      deleteItemAsync('mnemonic', KEYCHAIN_OPTION),
    ]);
    return true;
  } catch (error) {
    console.log('wipeStaleWalletKeychain error', error);
    return false;
  }
}

async function deleteItem(key) {
  try {
    crashlyticsLogReport('Starting delte item from secure store function');
    await deleteItemAsync(key, KEYCHAIN_OPTION);

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
      getItemAsync('pin'),
      getItemAsync('mnemonic'),
    ]);

    if (oldPin || oldMnemonic) {
      const pinStored = oldPin ? await storeData('pinHash', oldPin) : true;
      const mnemonicStored = oldMnemonic
        ? await storeData('encryptedMnemonic', oldMnemonic)
        : true;
      // Only delete the legacy source-of-truth once the copy is confirmed
      // written; storeData swallows errors and returns false. If we deleted on
      // a failed write we'd destroy the only seed copy with no retry.
      if (!pinStored || !mnemonicStored) {
        throw new Error('SecureStore migration write failed; will retry');
      }
      if (oldPin) await deleteItemAsync('pin');
      if (oldMnemonic) await deleteItemAsync('mnemonic');
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
      getItemAsync('pin', KEYCHAIN_OPTION),
      getItemAsync('mnemonic', KEYCHAIN_OPTION),
    ]);

    if (plainPin && plainMnemonic) {
      const pinStored = await storeData('pinHash', plainPin);
      const mnemonicStored = await storeData(
        'encryptedMnemonic',
        plainMnemonic,
      );

      // Only delete once the copy is confirmed written (storeData returns false
      // on failure); otherwise a failed write would destroy the only seed copy.
      if (!pinStored || !mnemonicStored) {
        throw new Error('V2 SecureStore migration write failed; will retry');
      }

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
  wipeStaleWalletKeychain,
  deleteItem,
  runPinAndMnemoicMigration,
  runSecureStoreMigrationV2,
};
