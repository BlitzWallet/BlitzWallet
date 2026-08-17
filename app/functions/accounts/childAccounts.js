import { getPublicKey } from 'nostr-tools';
import { HDKey } from '@scure/bip32';
import { bytesToHex } from '@noble/hashes/utils';
import {
  MAX_INDEX_FOR_CHILDREN_DERIVE,
  STARTING_INDEX_FOR_CHILDREN_DERIVE,
} from '../../constants';
import { deriveSparkGiftMnemonic } from '../gift/deriveGiftWallet';
import {
  mnemonicToSeedAsync,
  privateKeyFromSeedWords,
} from '../nostrCompatability';

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
  // Hard cap: children must stay below the BIP32 hardened-index limit
  // (2^31-1). getNextChildDerivationIndex fails closed at the same boundary,
  // so no child can ever derive an index that overlaps another derivation
  // space or exceeds the hardened range.
  if (
    STARTING_INDEX_FOR_CHILDREN_DERIVE + childIndex >=
    MAX_INDEX_FOR_CHILDREN_DERIVE
  ) {
    throw new Error(
      `Child index ${childIndex} exceeds the maximum of ${
        MAX_INDEX_FOR_CHILDREN_DERIVE - STARTING_INDEX_FOR_CHILDREN_DERIVE - 1
      } children`,
    );
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
 * Compute the next child derivation index a parent should allocate. Mirrors
 * the sequential space used by user accounts/gifts/pools: the counter wins
 * unless a child in the registry was created with a higher index (e.g. after a
 * failed write that burned an index). Pure — callers (db transactions, UI)
 * pass the parent's stored data so allocation is always based on the same
 * rule.
 * @param {Object} parentData - Parent doc data (childAccounts, nextChildDerivationIndex)
 * @returns {number} Next child index to allocate
 */
export function getNextChildDerivationIndex({
  childAccounts,
  nextChildDerivationIndex,
} = {}) {
  const counter = Number(nextChildDerivationIndex || 0);
  const maxExisting = (childAccounts || []).reduce(
    (m, c) => Math.max(m, Number(c.childIndex ?? -1)),
    -1,
  );
  const next = Math.max(counter, maxExisting + 1);
  // Fail closed at the child-space boundary: if a corrupted counter (or a
  // registry entry written beyond the cap) ever asks for an index past
  // MAX_INDEX_FOR_CHILDREN_DERIVE, throw rather than saturate — a saturated
  // counter would hand the same index to every future create, which is a
  // collision. deriveChildMnemonic enforces the same bound as a backstop.
  const maxChildIndex =
    MAX_INDEX_FOR_CHILDREN_DERIVE - STARTING_INDEX_FOR_CHILDREN_DERIVE - 1;
  if (next > maxChildIndex) {
    throw new Error(
      `Child derivation space exhausted (max index ${maxChildIndex})`,
    );
  }
  return next;
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

/**
 * Derive the parent-only authority keypair for a child. This is the proof the
 * backend (updateChildAccount) uses to know the caller is the PARENT and not the
 * child itself: it lives in the same HD tree as the child's key but under the
 * key-type field 1' instead of 0', so it is never the child's spend key and the
 * child — which holds only its own independent mnemonic — cannot derive it.
 * Per-child (keyed by childIndex) so sibling children never share an authPub.
 * authPub is produced via the same getPublicKey path as childPublicKey, so it is
 * ECDH-compatible with the encriptMessage/decryptMessage backend proof.
 * @param {string} mainSeed - Parent's main wallet mnemonic
 * @param {number} childIndex - Sequential child index
 * @returns {Promise<{ authPriv: string, authPub: string }>}
 */
export async function deriveChildAuthKey(mainSeed, childIndex) {
  if (
    typeof childIndex !== 'number' ||
    childIndex < 0 ||
    !Number.isInteger(childIndex)
  ) {
    throw new Error(`Child index ${childIndex} is invalid`);
  }
  // Same hard cap as deriveChildMnemonic — a parent can never derive an auth
  // key at an index the child itself could not have been allocated.
  if (
    STARTING_INDEX_FOR_CHILDREN_DERIVE + childIndex >=
    MAX_INDEX_FOR_CHILDREN_DERIVE
  ) {
    throw new Error(
      `Child index ${childIndex} exceeds the maximum of ${
        MAX_INDEX_FOR_CHILDREN_DERIVE - STARTING_INDEX_FOR_CHILDREN_DERIVE - 1
      } children`,
    );
  }
  if (!mainSeed || typeof mainSeed !== 'string') {
    throw new Error('Main seed must be a non-empty string');
  }
  const path = `m/8797555'/${
    STARTING_INDEX_FOR_CHILDREN_DERIVE + childIndex
  }'/1'`;
  const seed = await mnemonicToSeedAsync(mainSeed);
  const node = HDKey.fromMasterSeed(seed).derive(path);
  const authPriv = bytesToHex(node.privateKey);
  return { authPriv, authPub: getPublicKey(authPriv) };
}
