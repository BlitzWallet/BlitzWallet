import {
  deriveSparkGiftMnemonic,
  deriveSparkIdentityKey,
  deriveSparkAddress,
} from '../gift/deriveGiftWallet';

/**
 * Derives a pool wallet from the account mnemonic at the given derivation index.
 * Uses the same BIP derivation as gifts (m/8797555'/{index}'/0') but with a
 * separate index namespace (starting at STARTING_INDEX_FOR_POOLS_DERIVE = 100000).
 *
 * The pool mnemonic is NOT stored anywhere — it is always re-derived from
 * the account mnemonic + derivationIndex whenever needed (e.g., closing the pool).
 *
 * @param {string} accountMnemonic - The master account mnemonic phrase
 * @param {number} poolDerivationIndex - The pool derivation index (STARTING_INDEX_FOR_POOLS_DERIVE + poolIndex)
 * @returns {Promise<Object>} Derived wallet info including mnemonic, pubkey hex, spark address, and index
 */
export async function derivePoolWallet(accountMnemonic, poolDerivationIndex) {
  // 1. Derive mnemonic using same function as gifts but with pool index
  const derived = await deriveSparkGiftMnemonic(
    accountMnemonic,
    poolDerivationIndex,
  );
  if (!derived.success) {
    throw new Error(derived.error || 'Failed to derive pool wallet mnemonic');
  }

  // 2. Get identity key from derived mnemonic
  const identityKey = await deriveSparkIdentityKey(derived.derivedMnemonic, 1);
  if (!identityKey.success) {
    throw new Error(identityKey.error || 'Failed to derive pool identity key');
  }

  // 3. Get spark address from identity public key
  const sparkAddr = deriveSparkAddress(identityKey.publicKey);
  if (!sparkAddr.success) {
    throw new Error(sparkAddr.error || 'Failed to derive pool spark address');
  }

  return {
    mnemonic: derived.derivedMnemonic,
    identityPubKeyHex: identityKey.publicKeyHex,
    sparkAddress: sparkAddr.address,
    derivationIndex: poolDerivationIndex,
  };
}
