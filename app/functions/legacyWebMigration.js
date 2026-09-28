// One-time migration for wallets created by the legacy `blitz-web-app` (Vite).
//
// The legacy app kept the master mnemonic at localStorage["walletKey"],
// AES-encrypted under the user's password with CryptoJS's EvpKDF. This app
// keeps it in IndexedDB as an Argon2id + AES-256-GCM v3 envelope. Same origin,
// same password, different store and different KDF — so the seed has to be
// decrypted and re-encrypted; copying the ciphertext across would not be
// readable.
//
// Safety model: nothing is deleted until storeMnemonicWithPinSecurity has
// written the new envelope, read it back, AND decrypted it to the same seed
// through the login reader, and the account list has been
// re-encrypted under the new format. Every earlier failure leaves the legacy
// data exactly as it was, so the user can reload and try again.
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { CUSTODY_ACCOUNTS_STORAGE_KEY } from '../constants';
import {
  decryptMnemonic,
  decryptMnemonicWithPin,
  storeMnemonicWithPinSecurity,
} from './handleMnemonic';
import {
  loadCustodyAccounts,
  writeCustodyAccounts,
} from './custodyAccountsCrypto';
import {
  getAllLocalKeys,
  getLocalStorageItem,
  removeLocalStorageItem,
} from './localStorage';

// Written only by the legacy app — its presence is what triggers the migration.
export const LEGACY_WALLET_KEY = 'walletKey';

// IndexedDB databases the legacy app created. All caches: transactions re-sync
// from Spark, messages and settings from Firestore, images from storage.
// Deliberately excludes `blitz-secure-store` (holds the new envelope) and
// `firebaseLocalStorageDb` (auth session).
const LEGACY_DATABASES = [
  'spark-info-db',
  'CASHED_CONTACTS_MESSAGES',
  'pos-transactions-db',
  'SAVED_GIFTS',
  'SAVED_POOLS',
  'SAVED_SAVINGS',
  'giftCards',
  'ImageCacheDB',
  'blitzImageCache',
];

// The legacy Storage helper JSON.stringify'd every value, so a string was
// stored quoted. Unwrap that, tolerating a raw value just in case.
function unwrapLegacyString(value) {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : value;
  } catch {
    return value;
  }
}

// Best-effort: a cache that refuses to drop must not fail the migration.
function deleteLegacyDatabases() {
  if (typeof indexedDB === 'undefined') return Promise.resolve();
  return Promise.all(
    LEGACY_DATABASES.map(
      name =>
        new Promise(resolve => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = resolve;
          request.onerror = resolve;
          request.onblocked = resolve;
        }),
    ),
  );
}

/**
 * Moves a legacy web wallet into this app's storage and deletes the old data.
 *
 * @param {string} password The password the user used in the legacy app.
 * @returns {Promise<{status: 'ok'|'wrong-password'|'absent'|'failed', mnemonic?: string}>}
 */
export async function migrateLegacyWallet(password) {
  const storedKey = await getLocalStorageItem(LEGACY_WALLET_KEY);
  if (!storedKey) return { status: 'absent' };

  const mnemonic = decryptMnemonic(unwrapLegacyString(storedKey), password);
  // EvpKDF decrypts are unauthenticated, so a wrong password can return truthy
  // garbage — the BIP39 checksum is what actually verifies the password.
  if (!mnemonic || !validateMnemonic(mnemonic, wordlist)) {
    return { status: 'wrong-password' };
  }

  // Read the old account list before anything is deleted. Derived accounts
  // could be re-derived from the seed, but imported ones exist nowhere else.
  const rawCustody = await getLocalStorageItem(CUSTODY_ACCOUNTS_STORAGE_KEY);
  const custodyAccounts = rawCustody
    ? await loadCustodyAccounts(rawCustody, mnemonic)
    : [];

  // Writes the v3 envelope to IndexedDB and reads it back; false if either
  // half failed. Until this returns true, nothing may be deleted.
  const stored = await storeMnemonicWithPinSecurity(mnemonic, password);
  if (!stored) return { status: 'failed' };

  // A byte-exact read-back only proves storage; prove the login reader can
  // actually decrypt it to this seed before destroying the only other copy.
  const verified = await decryptMnemonicWithPin(JSON.stringify(password));
  if (verified !== mnemonic) return { status: 'failed' };

  // Re-encrypt the account list under the new format BEFORE the wipe, so the
  // accounts are never held only in memory. An empty result means either there
  // were none or none decrypted; in both cases leave the stored value alone
  // rather than overwrite material we could not read.
  if (custodyAccounts.length) {
    await writeCustodyAccounts(custodyAccounts, mnemonic);
  }

  // Everything else in this origin's localStorage is legacy. The shapes differ
  // from what this app writes (the legacy helper double-serialized values), so
  // clear the lot instead of trying to reconcile key by key.
  const keys = await getAllLocalKeys();
  await Promise.all(
    keys
      .filter(key => key !== CUSTODY_ACCOUNTS_STORAGE_KEY)
      .map(key => removeLocalStorageItem(key)),
  );

  await deleteLegacyDatabases();

  return { status: 'ok', mnemonic };
}
