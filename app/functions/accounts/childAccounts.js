import { getPublicKey } from 'nostr-tools';
import { STARTING_INDEX_FOR_CHILDREN_DERIVE } from '../../constants';
import { deriveSparkGiftMnemonic } from '../gift/deriveGiftWallet';
import { privateKeyFromSeedWords } from '../nostrCompatability';

/**
 * Derive a child account's mnemonic from the parent's main seed.
 * Uses the same Spark derivation scheme as gifts/pools (m/8797555'/{index}'/0')
 * but in the dedicated child index space (300000+), so it never collides with
 * user accounts (0-999), gifts (1000+), pools (100000+) or savings (200000+).
 * @param {string} mainSeed - Parent's main wallet mnemonic
 * @param {number} childIndex - Sequential child index (0-based)
 * @returns {Promise<string>} Derived child mnemonic
 */
export async function deriveChildMnemonic(mainSeed, childIndex) {
  if (
    typeof childIndex !== 'number' ||
    childIndex < 0 ||
    !Number.isInteger(childIndex)
  ) {
    throw new Error(`Child index ${childIndex} is invalid`);
  }
  if (!mainSeed || typeof mainSeed !== 'string') {
    throw new Error('Main seed must be a non-empty string');
  }

  const result = await deriveSparkGiftMnemonic(
    mainSeed,
    STARTING_INDEX_FOR_CHILDREN_DERIVE + childIndex,
  );
  if (!result.success) {
    throw new Error(result.error || 'Failed to derive child account');
  }
  return result.derivedMnemonic;
}

/**
 * Compute the child's Firebase UID (== contacts public key) from its mnemonic.
 * Mirrors the login derivation in loadingScreen.js so the parent can write to
 * the child's blitzWalletUsers doc without the child being online.
 * @param {string} childMnemonic
 * @returns {Promise<string>} Child public key / Firebase UID
 */
export async function getChildPublicKey(childMnemonic) {
  const privateKey = await privateKeyFromSeedWords(childMnemonic);
  return getPublicKey(privateKey);
}

/**
 * Reserve a child index: derive its seed + public key for the pairing session.
 * Pure — the caller creates the nested Firestore doc and runs the handoff.
 * @param {Object} params
 * @param {string} params.mainSeed - Parent's main wallet mnemonic
 * @param {number} params.childIndex - Sequential child index
 * @returns {Promise<{ childIndex: number, childPublicKey: string, childMnemonic: string }>}
 */
export async function reserveChild({ mainSeed, childIndex }) {
  const childMnemonic = await deriveChildMnemonic(mainSeed, childIndex);
  const childPublicKey = await getChildPublicKey(childMnemonic);
  return { childIndex, childPublicKey, childMnemonic };
}
