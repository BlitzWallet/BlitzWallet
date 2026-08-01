import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { AES, Utf8 } from 'crypto-es';
import crypto, { argon2 as argon2KDF } from 'react-native-quick-crypto';
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
import * as SecureStorage from 'expo-secure-store';
import { removeLocalStorageItem, setLocalStorageItem } from './localStorage';

const ARGON2_SALT_BYTES = 16;
const ARGON2_KEY_LEN = 32;
const ARGON2_PARAMS = { memory: 19456, passes: 2, parallelism: 1 }; // OWASP baseline (was 16384)
const LEGACY_ARGON2_PARAMS = { memory: 16384, passes: 2, parallelism: 1 }; // params shipped before the raise; used for pre-existing v2 ciphertexts that don't embed m/t/p
// Non-secret marker written to `pinHash`. Not JSON, so `needsToBeMigrated`
// (JSON.parse succeeds ⇒ raw-PIN artifact) stays false for PIN-secured users.
export const PIN_MARKER = 'pin-secured';

function argon2Async(password, salt, params) {
  return new Promise((resolve, reject) =>
    argon2KDF(
      'argon2id',
      {
        message: password,
        nonce: salt,
        tagLength: ARGON2_KEY_LEN,
        ...params,
      },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}

async function encryptMnemonicArgon2(mnemonic, pinString) {
  const salt = crypto.randomBytes(ARGON2_SALT_BYTES);
  const iv = crypto.randomBytes(16);
  const keyBuf = await argon2Async(pinString, salt, ARGON2_PARAMS);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, iv);
  const ct = Buffer.concat([
    cipher.update(Buffer.from(mnemonic, 'utf8')),
    cipher.final(),
  ]).toString('base64');
  return JSON.stringify({
    v: 2,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    ct,
    m: ARGON2_PARAMS.memory,
    t: ARGON2_PARAMS.passes,
    p: ARGON2_PARAMS.parallelism,
  });
}

async function decryptMnemonicArgon2(cipherText, pinString) {
  const { salt, iv, ct, m, t, p } = JSON.parse(cipherText);
  // Absent m/t/p ⇒ a ciphertext written before params were embedded, which
  // shipped only with LEGACY_ARGON2_PARAMS. This fallback is the backward-compat hinge.
  const keyBuf = await argon2Async(pinString, Buffer.from(salt, 'hex'), {
    memory: m ?? LEGACY_ARGON2_PARAMS.memory,
    passes: t ?? LEGACY_ARGON2_PARAMS.passes,
    parallelism: p ?? LEGACY_ARGON2_PARAMS.parallelism,
  });
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    keyBuf,
    Buffer.from(iv, 'hex'),
  );
  return Buffer.concat([
    decipher.update(Buffer.from(ct, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

// True when a v2 ciphertext was derived with weaker-than-current params (or
// none embedded ⇒ legacy 16384), so it should be opportunistically re-encrypted.
function argon2NeedsUpgrade(cipherText) {
  try {
    const { m } = JSON.parse(cipherText);
    return m == null || m < ARGON2_PARAMS.memory;
  } catch {
    return false;
  }
}

// Fire-and-forget re-encrypt guarded by a compare-and-swap: only overwrite
// `encryptedMnemonic` if it still equals the ciphertext we decrypted. Without
// this, a re-encrypt in flight from login can land after (and clobber) a
// concurrent PIN change → the new PIN can't decrypt → lockout.
// ponytail: sub-ms TOCTOU remains between the re-read and the write; a PIN
// change landing in that window is negligible and self-heals next login.
function reEncryptIfUnchanged(mnemonic, pin, staleCipherText, label) {
  encryptMnemonicArgon2(mnemonic, pin)
    .then(async ct => {
      const current = await retrieveData('encryptedMnemonic');
      if (current.value === staleCipherText) {
        await storeData('encryptedMnemonic', ct);
      }
    })
    .catch(err =>
      console.log(`${label} write failed, will retry next login`, err),
    );
}

export function isArgon2Format(cipherText) {
  try {
    const p = JSON.parse(cipherText);
    return (
      p?.v === 2 &&
      typeof p.salt === 'string' &&
      typeof p.iv === 'string' &&
      typeof p.ct === 'string'
    );
  } catch {
    return false;
  }
}

export async function generateAndStoreEncryptionKeyForMnemoinc() {
  try {
    const existingKey = await retrieveData(BIOMETRIC_KEY);
    if (existingKey.didWork && existingKey.value) return existingKey.value;

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
    const encrypted = await encryptMnemonicArgon2(
      mnemonic,
      JSON.stringify(pin),
    );
    // Ciphertext first, marker last: a crash between the two writes must never
    // leave the marker set over a stale ciphertext (that would send a correct
    // PIN down the decrypt path, fail, and count as wrong → lockout). With this
    // order a lost marker just self-heals on the next login. No PIN verifier is
    // stored — the Argon2+AES ciphertext already verifies the PIN (wrong PIN ⇒
    // padding failure). PIN_MARKER only keeps needsToBeMigrated false.
    await storeData('encryptedMnemonic', encrypted);
    await storeData('pinHash', PIN_MARKER);
    return true;
  } catch (err) {
    console.log('error encrypting mnemonic with pin', err);
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
    const cipherText = await retrieveData('encryptedMnemonic');
    if (!cipherText.didWork) return null;

    const staleCt = cipherText.value;
    let decrypted;
    if (isArgon2Format(cipherText.value)) {
      decrypted = await decryptMnemonicArgon2(cipherText.value, pin);
      // Opportunistically re-encrypt weak/legacy-param ciphertexts to current KDF.
      if (decrypted && argon2NeedsUpgrade(cipherText.value)) {
        reEncryptIfUnchanged(decrypted, pin, staleCt, 'kdf upgrade');
      }
    } else {
      // Legacy EvpKDF format — decrypt then re-encrypt with Argon2
      decrypted = decryptMnemonic(cipherText.value, pin);
      if (decrypted) {
        reEncryptIfUnchanged(decrypted, pin, staleCt, 'migration');
      }
    }

    // Decrypt-to-verify: a wrong PIN yields a wrong key, which almost always
    // fails AES/PKCS7 padding (⇒ throw ⇒ caught ⇒ null). validateMnemonic
    // closes the ~1/256 wrong-key-yet-valid-padding gap. On success we also
    // scrub any stale sha256 oracle left in pinHash by pre-update installs.
    if (decrypted && validateMnemonic(decrypted, wordlist)) {
      // Best-effort scrub of any stale sha256 oracle; must not sink a valid login.
      storeData('pinHash', PIN_MARKER).catch(err =>
        console.log('pin marker write failed', err),
      );
      return decrypted;
    }
    return null;
  } catch (err) {
    console.log('decrypt mnemonic with pin error', err);
    return null;
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
