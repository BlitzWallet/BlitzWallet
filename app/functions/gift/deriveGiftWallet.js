import { bytesToHex } from '@noble/hashes/utils';
import { HDKey } from '@scure/bip32';
import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import sha256Hash from '../hash';
import { mnemonicToSeedAsync } from '../nostrCompatability';
import { encodeSparkAddress } from '../spark/sparkAddressCodec';
import { GIFT_DERIVE_PATH_CUTOFF } from '../../constants';
import { deriveKeyFromMnemonic } from '../seed';

/**
 * Derives a mnemonic for a Spark Wallet gift at a specific index
 * @param {string} mnemonic - The master account mnemonic phrase
 * @param {number} giftIndex - The gift derivation index
 * @param {number} accountNumber - Spark account number (default: 1 for SDK compatibility)
 * @returns {Promise<Object>} Derived mnemonic and key information
 */
export async function deriveSparkGiftMnemonic(
  mnemonic,
  giftIndex = 0,
  accountNumber = 1,
) {
  try {
    // Hard cap at the BIP32 hardened-index limit (2^31-1): every derivation
    // space (accounts/gifts/pools/savings/children) flows through here, so
    // this is the single backstop that no space can ever overflow. @scure/bip32
    // would throw for these too, but with a cryptic "invalid child index" —
    // fail fast with a clear message instead. Purposfully does not use
    // 2147483648 limit as that would have @scure/bip32 throw.
    if (giftIndex >= 2147483647) {
      throw new Error(
        `Derivation index ${giftIndex} exceeds the BIP32 hardened-index limit (2147483646)`,
      );
    }
    // Derive the identity key for this gift using Spark's scheme
    // Path: m/8797555'/giftIndex'/0' (where 0' is the identity key type)
    const derivationPath = `m/8797555'/${giftIndex}'/0'`;

    const seed = await mnemonicToSeedAsync(mnemonic);
    const masterKey = HDKey.fromMasterSeed(seed);
    const identityKey = masterKey.derive(derivationPath);

    // Generate a mnemonic from the derived private key entropy
    const entropy128 = identityKey.privateKey.slice(0, 16);
    const derivedMnemonic = entropyToMnemonic(entropy128, wordlist);

    return {
      success: true,
      derivedMnemonic, // This mnemonic should be used to initialize Spark wallet
      identityPrivateKey: identityKey.privateKey,
      identityPublicKey: identityKey.publicKey,
      derivationPath: derivationPath,
      giftIndex,
      accountNumber, // The account number that Spark will use internally
    };
  } catch (err) {
    console.log('derive spark gift mnemonic error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Re-derives a gift's restore key (the gift wallet's BIP39 seed) on demand from
 * the account mnemonic + gift index. The seed is deliberately NOT stored
 * anywhere — it is always recomputed when a gift needs to be reclaimed, mirroring
 * the pool wallet approach.
 *
 * The derivation scheme is chosen by the gift's creation time so the re-derived
 * mnemonic is identical to the one used when the gift was created, keeping
 * backwards compatibility with gifts persisted before the scheme change.
 *
 * @param {string} accountMnemonic - The master account mnemonic phrase
 * @param {number} giftNum - The gift's derivation index
 * @param {number} createdTime - The gift's creation timestamp; selects the pre/post-cutoff derivation scheme
 * @returns {Promise<string>} The derived restore mnemonic
 */
export async function deriveGiftRestoreKey(
  accountMnemonic,
  giftNum,
  createdTime,
) {
  const result =
    createdTime > GIFT_DERIVE_PATH_CUTOFF
      ? await deriveSparkGiftMnemonic(accountMnemonic, giftNum)
      : await deriveKeyFromMnemonic(accountMnemonic, giftNum);

  if (!result.success) {
    throw new Error(result.error || 'Failed to derive gift restore key');
  }
  return result.derivedMnemonic;
}

/**
 * Derives the expected identity key that Spark will generate internally
 * Spark uses m/8797555'/accountNumber'/0' where accountNumber defaults to 1
 * @param {string} sparkMnemonic - The mnemonic that will be given to Spark
 * @param {number} accountNumber - Spark's account number (default: 1)
 * @returns {Promise<Object>} Expected identity key information
 */
export async function deriveSparkIdentityKey(sparkMnemonic, accountNumber = 1) {
  try {
    // Spark internally derives: m/8797555'/accountNumber'/0'
    // Where accountNumber defaults to 1 for backwards compatibility
    const derivationPath = `m/8797555'/${accountNumber}'/0'`;

    const seed = await mnemonicToSeedAsync(sparkMnemonic);
    const masterKey = HDKey.fromMasterSeed(seed);
    const identityKey = masterKey.derive(derivationPath);

    return {
      success: true,
      privateKey: identityKey.privateKey,
      publicKey: identityKey.publicKey,
      publicKeyHex: Buffer.from(identityKey.publicKey).toString('hex'),
      chainCode: identityKey.chainCode,
      depth: identityKey.depth,
      index: identityKey.index,
      parentFingerprint: identityKey.parentFingerprint,
      derivationPath: derivationPath,
      accountNumber,
      keyType: 'identity',
    };
  } catch (err) {
    console.log('derive spark identity key error:', err);
    return { success: false, error: err.message };
  }
}

// Spark identity PUBLIC keys per mnemonic (account number + mnemonic hash, never
// the mnemonic itself). The public half is not secret, so holding it for the
// session costs nothing; the private half is never stored here. identityFor in
// walletRuntime runs on every acquire — including the borrow path every facade
// call takes — so this removes the repeated PBKDF2 + HDKey work from connect,
// balance reads, the history diff and the pending sweep.
const sparkIdentityPublicKeys = new Map();

// sha256Hash returns false on failure; a shared "1:false" key would hand one
// mnemonic's identity to every other, so a failed hash skips the cache.
const identityCacheKey = (mnemonic, accountNumber) => {
  const hash = sha256Hash(mnemonic);
  return hash ? `${accountNumber}:${hash}` : null;
};

export async function getSparkIdentityPublicKey(mnemonic, accountNumber = 1) {
  const key = identityCacheKey(mnemonic, accountNumber);
  const cached = key && sparkIdentityPublicKeys.get(key);
  if (cached) return cached;

  const entry = deriveSparkIdentityKey(mnemonic, accountNumber).then(derived =>
    derived?.publicKeyHex
      ? { publicKeyHex: derived.publicKeyHex, publicKey: derived.publicKey }
      : null,
  );
  if (!key) return entry;
  // A miss must not stick: the next call retries the derivation.
  entry.then(value => {
    if (!value) sparkIdentityPublicKeys.delete(key);
  });
  sparkIdentityPublicKeys.set(key, entry);
  return entry;
}

// Logout / reset; mirrors clearMnemonicCache in spark/index.js.
export function clearSparkIdentityPublicKeyCache() {
  sparkIdentityPublicKeys.clear();
}

/**
 * The two keys the login path needs — the Nostr private key
 * (m/44'/1237'/0'/0/0) and the Spark identity key (m/8797555'/account'/0') —
 * from a single PBKDF2 pass. privateKeyFromSeedWords and deriveSparkIdentityKey
 * each derive the same seed, so calling both (as the loading screen used to)
 * runs PBKDF2 over the mnemonic twice. The seed is zeroed before returning: the
 * mnemonic is already held by the app, its seed must not be held too.
 */
export async function deriveLoginKeys(mnemonic, accountNumber = 1) {
  const seed = await mnemonicToSeedAsync(mnemonic);
  try {
    const masterKey = HDKey.fromMasterSeed(seed);
    const nostrPrivateKey = masterKey.derive(`m/44'/1237'/0'/0/0`).privateKey;
    if (!nostrPrivateKey) throw new Error('could not derive private key');

    const identityKey = masterKey.derive(`m/8797555'/${accountNumber}'/0'`);
    const identityPublicKey = {
      publicKeyHex: Buffer.from(identityKey.publicKey).toString('hex'),
      publicKey: identityKey.publicKey,
    };
    const key = identityCacheKey(mnemonic, accountNumber);
    if (key)
      sparkIdentityPublicKeys.set(key, Promise.resolve(identityPublicKey));

    return {
      privateKey: bytesToHex(nostrPrivateKey),
      identityPubKeyHex: identityPublicKey.publicKeyHex,
    };
  } finally {
    seed.fill(0);
  }
}

/**
 * Derives the spark address from the identity key
 * @param {string} identityKey - The mnemonic that will be given to Spark
 * @returns {Promise<Object>} Expected spark address
 */
export function deriveSparkAddress(identityPublicKey) {
  try {
    if (
      !(identityPublicKey instanceof Uint8Array) ||
      identityPublicKey.length !== 33
    ) {
      throw new Error(
        'identityPublicKey must be a 33-byte compressed Uint8Array',
      );
    }

    const address = encodeSparkAddress({
      identityPublicKey: Buffer.from(identityPublicKey).toString('hex'),
    });

    return {
      success: true,
      address,
    };
  } catch (err) {
    console.log('derive spark identity key error:', err);
    return { success: false, error: err.message };
  }
}
