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
      `Derivation index ${derivationIndex} out of range (0-${
        MAX_DERIVED_ACCOUNTS - 1
      })`,
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

/**
 * Returns array of derivation indices that can be restored (gaps in account sequence)
 * @param {Array} custodyAccounts - Current account list
 * @param {number} nextAccountDerivationIndex - Highest index + 1 (from masterInfoObject)
 * @returns {Array<number>} Available indices for restoration (sorted ascending)
 */
export function getRestorableIndices(
  custodyAccounts,
  nextAccountDerivationIndex,
) {
  try {
    // Clamp to the account derivation range (0..MAX_DERIVED_ACCOUNTS-1).
    // Indices >= MAX_DERIVED_ACCOUNTS belong to the gift wallet range and can
    // never be restored as accounts, so they must never be enumerated here.
    const maxIndex = Math.min(
      Math.max(3, Math.floor(Number(nextAccountDerivationIndex) || 3)),
      MAX_DERIVED_ACCOUNTS - 1,
    );
    const existingIndices = new Set(
      custodyAccounts
        .filter(acc => acc.accountType === 'derived')
        .map(acc => acc.derivationIndex)
        .filter(idx => typeof idx === 'number'),
    );

    const restorable = [];
    if (maxIndex === 3) return restorable;
    for (let i = 4; i <= maxIndex; i++) {
      if (!existingIndices.has(i)) {
        restorable.push(i);
      }
    }

    return restorable;
  } catch (err) {
    return [];
  }
}
