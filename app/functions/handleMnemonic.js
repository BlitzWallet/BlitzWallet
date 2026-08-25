import { validateMnemonic } from '@scure/bip39';
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
import {
  decryptGCM,
  encryptGCM,
  isGcmV3,
  parseKdfParams,
} from './gcmEnvelope';
import { crashlyticsLogReport } from './crashlyticsLogs';

const ARGON2_SALT_BYTES = 16;
const ARGON2_KEY_LEN = 32;
const ARGON2_PARAMS = { memory: 19456, passes: 2, parallelism: 1 }; // OWASP baseline (was 16384)
// Binds the v3 mnemonic envelope to this storage context so it can't be
// replayed into another field (mirrors custodyAccountsCrypto's AAD).
const MNEMONIC_AAD = Buffer.from('blitz.encryptedMnemonic.v3', 'utf8');
// Login-critical KDF bounds: a tampered m/t/p must not be able to make login
// allocate unbounded Argon2 memory (OOM at cold start bricks login) or pick
// degenerate parameters. Ceiling sized for low-end devices (legit params are
// 19456 KiB, so 64 MiB leaves ample margin).
const MNEMONIC_KDF_BOUNDS = { minMemoryKiB: 8 * 1024, maxMemoryKiB: 64 * 1024 };
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

async function encryptMnemonicV3(mnemonic, secret) {
  const salt = crypto.randomBytes(ARGON2_SALT_BYTES).toString('hex');
  const keyBuf = await argon2Async(secret, Buffer.from(salt, 'hex'), ARGON2_PARAMS);
  return encryptGCM(mnemonic, { key: keyBuf, salt, params: ARGON2_PARAMS }, MNEMONIC_AAD);
}

async function decryptMnemonicV3(envelope, secret) {
  const env = JSON.parse(envelope);
  const params = parseKdfParams(env, MNEMONIC_KDF_BOUNDS);
  const keyBuf = await argon2Async(secret, Buffer.from(env.salt, 'hex'), params);
  return decryptGCM(envelope, keyBuf, MNEMONIC_AAD);
}

async function decryptMnemonicArgon2(cipherText, pinString) {
  const { salt, iv, ct } = JSON.parse(cipherText);
  // m/t/p are attacker-influenced on a v2 read too: bound them exactly like v3
  // (absent ⇒ legacy 16384 fallback — the backward-compat hinge).
  const params = parseKdfParams(JSON.parse(cipherText), MNEMONIC_KDF_BOUNDS);
  const keyBuf = await argon2Async(pinString, Buffer.from(salt, 'hex'), params);
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

export function isV3MnemonicFormat(value) {
  return isGcmV3(value);
}

export function isLegacyEvpKDF(value) {
  return typeof value === 'string' && value.startsWith('U2FsdGVkX1');
}

export function isEncryptedMnemonicFormat(value) {
  return (
    isV3MnemonicFormat(value) || isArgon2Format(value) || isLegacyEvpKDF(value)
  );
}

// Detected envelope version for the §8 decrypt-failure breadcrumb, letting
// support distinguish a genuine wrong secret from a downgrade (older build
// reading a v3 envelope) or a mode-switch crash artifact.
function detectEnvelopeVersion(value) {
  if (typeof value !== 'string' || !value) return 'unknown';
  if (isV3MnemonicFormat(value)) return 'v3';
  if (isArgon2Format(value)) return 'v2';
  if (isLegacyEvpKDF(value)) return 'evpkdf';
  if (validateMnemonic(value, wordlist)) return 'plaintext';
  return 'unknown';
}

// Awaited, CAS-guarded migration to the v3 envelope. Only overwrite
// `encryptedMnemonic` if it still equals the ciphertext we decrypted: without
// this, a migration in flight from login can land after (and clobber) a
// concurrent PIN change → the new PIN can't decrypt → lockout. Never throws to
// the caller — a failed write is logged and retried on the next login.
async function migrateMnemonicToV3(decrypted, secret, staleValue) {
  try {
    crashlyticsLogReport('v3 mnemonic migration start');
    const v3 = await encryptMnemonicV3(decrypted, secret);
    const current = await retrieveData('encryptedMnemonic');
    if (!current.didWork || current.value !== staleValue) {
      crashlyticsLogReport('v3 mnemonic migration skipped-concurrent-change');
      return;
    }
    await storeData('encryptedMnemonic', v3);
    const readback = await retrieveData('encryptedMnemonic');
    if (readback.didWork && readback.value === v3) {
      crashlyticsLogReport('v3 mnemonic migration migrated');
    } else {
      crashlyticsLogReport('v3 mnemonic migration write-failed');
    }
  } catch (err) {
    console.log('v3 mnemonic migration write failed, will retry next login', err);
    crashlyticsLogReport('v3 mnemonic migration write-failed');
  }
}

export async function generateAndStoreEncryptionKeyForMnemoinc() {
  try {
    const existingKey = await retrieveData(BIOMETRIC_KEY);
    // didWork:false is a READ ERROR (locked keychain, cancelled prompt,
    // invalidated biometric key) — not "not set up". expo-secure-store
    // resolves null for an absent key, so absence arrives as didWork:true +
    // empty value. Regenerating on an error would overwrite a possibly-good
    // key and orphan any existing encryptedMnemonic ciphertext under it
    // (permanent lockout when biometrics is the only login mode), so fail
    // closed and let the caller retry later.
    if (!existingKey.didWork) return false;
    if (existingKey.value) return existingKey.value;

    const key = crypto.randomBytes(32).toString('hex');

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

    // Refuse to clobber an encryptedMnemonic holding a DIFFERENT valid
    // plaintext seed — overwriting it would destroy the only copy of that
    // wallet's seed. Same-seed plaintext must stay allowed so a crashed
    // migration (marker missing) can resume via handleLoginSecuritySwitch.
    const existing = await retrieveData('encryptedMnemonic');
    if (
      existing.didWork &&
      existing.value &&
      validateMnemonic(existing.value, wordlist) &&
      existing.value !== mnemonic
    ) {
      throw new Error(
        'Refusing to overwrite encryptedMnemonic holding a different seed',
      );
    }

    const cipherText = await encryptMnemonicV3(mnemonic, key);

    await storeData('encryptedMnemonic', cipherText);
    return true;
  } catch (err) {
    console.log('encrpt mnemoinc with biometric error', err);
    return false;
  }
}

// Tri-state return contract: the mnemonic string on success; null on a
// transient storage/auth read failure (safe to retry later); false on a
// definitive failure (no biometric key stored, no ciphertext stored, wrong
// key or corrupt envelope). Callers must never treat either falsy value as
// "biometrics not enrolled" and re-run the setup path — that rotates
// BIOMETRIC_KEY and orphans this ciphertext (seed loss).
export async function decryptMnemonicWithBiometrics() {
  try {
    const key = await retrieveData(BIOMETRIC_KEY);

    if (!key.didWork) return null;
    const cipherText = await retrieveData('encryptedMnemonic');

    if (!cipherText.didWork) return null;
    if (!cipherText.value || !key.value) return false;

    const value = cipherText.value;
    let decrypted;
    if (isV3MnemonicFormat(value)) {
      decrypted = await decryptMnemonicV3(value, key.value);
    } else if (isArgon2Format(value)) {
      decrypted = await decryptMnemonicArgon2(value, key.value);
    } else if (isLegacyEvpKDF(value)) {
      decrypted = decryptMnemonic(value, key.value);
    } else {
      decrypted = null;
    }

    // Decrypt-to-verify: crypto-es never validates PKCS7 padding, so a wrong
    // key on a legacy ciphertext can return truthy garbage; validateMnemonic
    // gates every format so corrupt-storage devices fail closed instead of
    // logging into a silent empty garbage-seed wallet.
    if (decrypted && validateMnemonic(decrypted, wordlist)) {
      if (!isV3MnemonicFormat(value)) {
        await migrateMnemonicToV3(decrypted, key.value, value);
      }
      return decrypted;
    }
    return false;
  } catch (err) {
    console.log('decrypt mnemoinc with biometric error', err);
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
    const encrypted = await encryptMnemonicV3(mnemonic, JSON.stringify(pin));
    // Ciphertext first, marker last: a crash between the two writes must never
    // leave the marker set over a stale ciphertext (that would send a correct
    // PIN down the decrypt path, fail, and count as wrong → lockout). With this
    // order a lost marker just self-heals on the next login. No PIN verifier is
    // stored — the Argon2+AES ciphertext already verifies the PIN (wrong PIN ⇒
    // GCM tag failure). PIN_MARKER only keeps needsToBeMigrated false.
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
  let version = 'unknown';
  try {
    const cipherText = await retrieveData('encryptedMnemonic');
    if (!cipherText.didWork) return null;

    const value = cipherText.value;
    version = detectEnvelopeVersion(value);
    let decrypted;
    if (isV3MnemonicFormat(value)) {
      decrypted = await decryptMnemonicV3(value, pin);
    } else if (isArgon2Format(value)) {
      decrypted = await decryptMnemonicArgon2(value, pin);
    } else if (isLegacyEvpKDF(value)) {
      decrypted = decryptMnemonic(value, pin);
    } else {
      decrypted = null;
    }

    // Decrypt-to-verify: a wrong PIN yields a wrong key, which fails the GCM
    // tag (v3) or AES/PKCS7 padding (v2) ⇒ throw ⇒ caught ⇒ null.
    // validateMnemonic closes the remaining wrong-key-yet-valid-padding gap on
    // legacy formats and MUST gate the migration too: re-encrypting garbage
    // would overwrite the real ciphertext and lock the wallet out permanently.
    if (decrypted && validateMnemonic(decrypted, wordlist)) {
      if (!isV3MnemonicFormat(value)) {
        // Legacy v2/EvpKDF — migrate to the authenticated v3 envelope.
        await migrateMnemonicToV3(decrypted, pin, value);
      }
      // Best-effort scrub of any stale raw-PIN sha256 oracle; must not sink a
      // valid login (B2).
      storeData('pinHash', PIN_MARKER).catch(err =>
        console.log('pin marker write failed', err),
      );
      return decrypted;
    }
    crashlyticsLogReport(
      `mnemonic decrypt failed (envelope version: ${version})`,
    );
    return null;
  } catch (err) {
    console.log('decrypt mnemonic with pin error', err);
    crashlyticsLogReport(
      `mnemonic decrypt failed (envelope version: ${version})`,
    );
    return null;
  }
}

/**
 * Pay to a Liquid address using the most efficient available payment method
/**
 * @param {Object} mnemoinc - String of mnemoinc
 * @param {Object} pin - String of pin
 * @param {string} storageType - String of storage type (pin, biometric)
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function handleLoginSecuritySwitch(mnemoinc, pin, storageType) {
  try {
    // Explicit branches only: an unknown/typo'd storageType must return false,
    // never silently encrypt under the biometric key.
    if (storageType === 'pin') {
      const response = await storeMnemonicWithPinSecurity(mnemoinc, pin);
      if (!response) throw new Error('Unable to save pin with encription');
    } else if (storageType === 'biometric') {
      const response = await encryptAndStoreMnemonicWithBiometrics(mnemoinc);
      if (!response)
        throw new Error('Unable to save mnemoinc with biometrics');
    } else {
      return false;
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
