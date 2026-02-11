import { MAX_DERIVED_ACCOUNTS } from '../../constants';
import { deriveSparkGiftMnemonic } from '../gift/deriveGiftWallet';

/**
 * Derive account mnemonic from main seed using Spark derivation scheme
 * Uses the same derivation path as gifts (m/8797555'/{index}'/0') but with a different index range
 * @param {string} mainSeed - Main wallet mnemonic
 * @param {number} derivationIndex - Account index (0-999)
 * @returns {Promise<string>} Derived mnemonic
 */
export async function deriveAccountMnemonic(mainSeed, derivationIndex) {
  // CRITICAL: Validate derivation index is in valid range
  if (
    typeof derivationIndex !== 'number' ||
    derivationIndex < 0 ||
    derivationIndex >= MAX_DERIVED_ACCOUNTS
  ) {
    throw new Error(
      `Derivation index ${derivationIndex} out of range (0-${MAX_DERIVED_ACCOUNTS - 1})`,
    );
  }

  if (!mainSeed || typeof mainSeed !== 'string') {
    throw new Error('Main seed must be a non-empty string');
  }

  // Reuse existing Spark derivation (same path as gifts, different index range)
  const result = await deriveSparkGiftMnemonic(mainSeed, derivationIndex);
  if (!result.success) {
    throw new Error(result.error || 'Failed to derive account');
  }
  return result.derivedMnemonic;
}

/**
 * Check if account is derived from main seed
 * @param {Object} account - Account object
 * @returns {boolean} True if account is derived
 */
export function isAccountDerived(account) {
  return (
    account &&
    typeof account === 'object' &&
    account.derivationIndex !== undefined &&
    account.derivationIndex !== null
  );
}

/**
 * Check if account is imported (standalone seed)
 * @param {Object} account - Account object
 * @returns {boolean} True if account is imported
 */
export function isAccountImported(account) {
  return (
    account &&
    typeof account === 'object' &&
    account.mnemoinc !== undefined &&
    account.mnemoinc !== null &&
    account.derivationIndex === undefined
  );
}
