import { HDKey } from '@scure/bip32';
import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { mnemonicToSeedAsync } from '../nostrCompatability';
import { bech32m } from 'bech32';
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

    const hrp = 'spark';
    const pubKeyLength = identityPublicKey.length; // 33 (0x21 in hex)

    // 1. Create the Protobuf-like payload
    // The total payload length is 1 (tag) + 1 (length byte) + 33 (pub key) = 35 bytes
    const dataPayload = new Uint8Array(2 + pubKeyLength);

    // Byte 0: Protobuf Tag (Field 1, Wire Type 2: Length-delimited) = 0x0A
    dataPayload[0] = 0x0a;

    // Byte 1: Length of the data (33 bytes / 0x21)
    dataPayload[1] = pubKeyLength;

    // Bytes 2-34: The 33-byte compressed public key
    dataPayload.set(identityPublicKey, 2);

    // 2. Convert the 35-byte payload to 5-bit words
    const words = bech32m.toWords(dataPayload);

    // 3. Encode with Bech32m
    const address = bech32m.encode(hrp, words);

    return {
      success: true,
      address,
    };
  } catch (err) {
    console.log('derive spark identity key error:', err);
    return { success: false, error: err.message };
  }
}
