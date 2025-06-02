import * as SecureStore from 'expo-secure-store';
import {
  getLocalStorageItem,
  removeAllLocalData,
  setLocalStorageItem,
} from './localStorage';
import * as CryptoES from 'crypto-es';
import {crashlyticsLogReport} from './crashlyticsLogs';
import sha256Hash from './hash';
const keychainService = '38WX44YTA6.com.blitzwallet.SharedKeychain';
const MIGRATION_FLAG = 'secureStoreMigrationComplete';
const SECURE_MIGRATION_V2_FLAG = 'secureStoreMigrationV2Complete';

const KEYCHAIN_OPTION = {
  keychainService: keychainService,
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function storeData(key, value) {
  try {
    crashlyticsLogReport('Starting store data to secure store function');
    await SecureStore.setItemAsync(key, value, KEYCHAIN_OPTION);
    return true;
  } catch (error) {
    console.log(error, 'SECURE STORE ERROR');
    return false;
  }
}

async function retrieveData(key) {
  try {
    crashlyticsLogReport('Starting retrive data from secure store function');

    const value = await SecureStore.getItemAsync(key, KEYCHAIN_OPTION);

    if (value) return value;
    else return false;
  } catch (error) {
    console.log('Error storing data to secure store', err);
    return false;
  }
}

async function terminateAccount() {
  try {
    crashlyticsLogReport('Starting termiate data from secure store function');
    await SecureStore.deleteItemAsync('pinHash', KEYCHAIN_OPTION);
    await SecureStore.deleteItemAsync('encryptedMnemonic', KEYCHAIN_OPTION);

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
      if (oldPin) await storeData('pin', oldPin);
      if (oldMnemonic) await storeData('mnemonic', oldMnemonic);
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
      // Hash the PIN and store it
      const hashedPin = hashPin(plainPin);
      await storeData('pinHash', hashedPin);

      // Encrypt mnemonic with PIN and store it
      const encryptedMnemonic = encryptMnemonic(plainMnemonic, plainPin);
      await storeData('encryptedMnemonic', encryptedMnemonic);

      // Delete old unencrypted values
      await SecureStore.deleteItemAsync('pin', KEYCHAIN_OPTION);
      await SecureStore.deleteItemAsync('mnemonic', KEYCHAIN_OPTION);
    }

    await setLocalStorageItem(SECURE_MIGRATION_V2_FLAG, 'true');
    crashlyticsLogReport('V2 SecureStore migration completed');
  } catch (error) {
    console.log('SecureStore Migration V2 Error:', error);
  }
}

function hashPin(pin) {
  return sha256Hash(pin);
}

function encryptMnemonic(mnemonic, pin) {
  try {
    return CryptoES.default.AES.encrypt(mnemonic, pin).toString();
  } catch (err) {
    console.log('error encripting mnemonic', err);
  }
}

async function getDecryptedMnemonic(pin) {
  const cipherText = await retrieveData('encryptedMnemonic');
  if (!cipherText) return null;

  try {
    const mnemonic = decryptMnemonic(cipherText, pin);
    if (!mnemonic) throw new Error('Invalid decryption');
    return mnemonic;
  } catch (error) {
    console.log('Mnemonic decryption failed:', error);
    return null;
  }
}
function decryptMnemonic(cipherText, pin) {
  const bytes = CryptoES.default.AES.decrypt(cipherText, pin);
  return bytes.toString(CryptoES.default.enc.Utf8);
}

export {
  retrieveData,
  storeData,
  terminateAccount,
  deleteItem,
  runPinAndMnemoicMigration,
  runSecureStoreMigrationV2,
  getDecryptedMnemonic,
  encryptMnemonic,
};
