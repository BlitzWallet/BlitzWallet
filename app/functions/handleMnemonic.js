import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { AES, Utf8 } from 'crypto-es';
import {
  BIOMETRIC_KEY,
  LOGIN_SECUITY_MODE_KEY,
  LOGIN_SECURITY_MODE_TYPE_KEY,
} from '../constants';
import {
  deleteItem,
  MIGRATION_FLAG,
  retrieveData,
  SECURE_MIGRATION_V2_FLAG,
  storeData,
} from './secureStore';
import sha256Hash from './hash';
import * as SecureStorage from 'expo-secure-store';
import { removeLocalStorageItem, setLocalStorageItem } from './localStorage';

export async function generateAndStoreEncryptionKeyForMnemoinc() {
  try {
    // const existingKey = await retrieveData(BIOMETRIC_KEY);
    // console.log(existingKey, 'existing key');

    // if (!existingKey.didWork)
    //   throw new Error('Unable to authenticate with biomentrics');

    // if (existingKey.value) return existingKey.value;

    const key = generateMnemonic(wordlist).toString();

    const response = await storeData(BIOMETRIC_KEY, key, {
      requireAuthentication: true,
    });
    if (!response) throw new Error('Error saving with biometric');

    return key;
  } catch (err) {
    console.log('Error generating and storing encription key', err);
    return false;
  }
}

export async function encryptAndStoreMnemonicWithBiometrics(mnemonic) {
  try {
    const key = await generateAndStoreEncryptionKeyForMnemoinc();
    if (!key) throw new Error('Unable to get encription key');

    const cipherText = AES.encrypt(mnemonic, key).toString();

    await storeData('encryptedMnemonic', cipherText);
    return true;
  } catch (err) {
    console.log('encrpt mnemoinc with biometric error', err);
    return false;
  }
}

export async function decryptMnemonicWithBiometrics() {
  try {
    const key = await retrieveData(BIOMETRIC_KEY);

    if (!key.didWork) return null;
    const cipherText = await retrieveData('encryptedMnemonic');
    console.log(key.value, cipherText);
    if (!cipherText.value || !key.value) return false;

    const decrypted = decryptMnemonic(cipherText.value, key.value);
    if (!decrypted) throw new Error('eror decrypting mnemionc with biometric');
    return decrypted;
  } catch (err) {
    console.log('decrypt mnemoinc with biometric error', err);
    return false;
  }
}
/**
 * stores mnemoinc with no encription
/**
 * @param {Object} mnemionc - String of mnemoinc
 * @returns {Promise<boolean>} - mnemoinc if successful, false otherwise
 */
export async function storeMnemoincWithNoSecurity(mnemonic) {
  try {
    await storeData('encryptedMnemonic', mnemonic);
    return true;
  } catch (err) {
    console.log('Error storing mnemoicn with no encription');
    return false;
  }
}

/**
 * stores mnemoinc with pin encription
/**
 * @param {Object} mnemionc - String of mnemoinc
 * @param {Object} pin - array of pin
 * @returns {Promise<boolean>} - mnemoinc if successful, false otherwise
 */
export async function storeMnemonicWithPinSecurity(mnemonic, pin) {
  try {
    const encripted = encryptMnemonic(mnemonic, JSON.stringify(pin));
    const pinHash = sha256Hash(JSON.stringify(pin));
    await storeData('pinHash', pinHash);
    await storeData('encryptedMnemonic', encripted);
    return true;
  } catch (err) {
    console.log('error encripting mnemonic with pin', err);
    return false;
  }
}
/**
 * decrypt mnemoinc with pin
/**
 * @param {Object} pin - String of pin
 * @returns {Promise<boolean>} - mnemoinc if successful, false otherwise
 */
export async function decryptMnemonicWithPin(pin) {
  try {
    console.log(pin);
    const cipherText = await retrieveData('encryptedMnemonic');
    if (!cipherText.didWork) return null;
    console.log(cipherText.value);

    const decrypted = decryptMnemonic(cipherText.value, pin);
    if (!decrypted) throw new Error('eror decrypting mnemionc with pin');
    return decrypted;
  } catch (err) {
    console.log('decrypt mnemoinc with pin error', err);
  }
}

/**
 * Pay to a Liquid address using the most efficient available payment method
/**
 * @param {Object} mnemoinc - String of mnemoinc
 * @param {Object} pin - String of pin
 * @param {string} storageType - String of storage type (plain, pin, biometric)
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function handleLoginSecuritySwitch(mnemoinc, pin, storageType) {
  try {
    if (storageType === 'plain') {
      const response = await storeMnemoincWithNoSecurity(mnemoinc);
      if (!response) throw new Error('Unable to save pin with no encription');
    } else if (storageType === 'pin') {
      const response = await storeMnemonicWithPinSecurity(mnemoinc, pin);
      if (!response) throw new Error('Unable to save pin with no encription');
    } else {
      const response = await encryptAndStoreMnemonicWithBiometrics(mnemoinc);
      if (!response)
        throw new Error('Unable to save mnemoinc with no biometrics');
    }
    await storeData(LOGIN_SECURITY_MODE_TYPE_KEY, storageType);
    return true;
  } catch (error) {
    console.log('SecureStore Migration Error:', error);
    return false;
  }
}

export function decryptMnemonic(cipherText, pin) {
  try {
    const bytes = AES.decrypt(cipherText, pin);
    return bytes.toString(Utf8);
  } catch (err) {
    console.log('error decrypting mnemoinc', err);
    return false;
  }
}

export function encryptMnemonic(mnemonic, pin) {
  try {
    return AES.encrypt(mnemonic, pin).toString();
  } catch (err) {
    console.log('error encripting mnemonic', err);
  }
}

export async function resetTest() {
  deleteItem('pinHash');
  deleteItem('encryptedMnemonic');
  SecureStorage.deleteItemAsync('pin');
  SecureStorage.deleteItemAsync('mnemonic');
  removeLocalStorageItem(SECURE_MIGRATION_V2_FLAG);
  removeLocalStorageItem(MIGRATION_FLAG);
  setLocalStorageItem(
    LOGIN_SECUITY_MODE_KEY,
    JSON.stringify({
      isSecurityEnabled: true,
      isPinEnabled: true,
      isBiometricEnabled: false,
    }),
  );
}
