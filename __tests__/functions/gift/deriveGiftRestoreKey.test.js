/* eslint-env jest */
// ---------------------------------------------------------------------------
// deriveGiftRestoreKey — on-demand restore key re-derivation (M1 storage fix).
//
// The gift wallet seed used to be persisted as `restoreKey` in the local
// SQLite gift DB. It is now never stored; it is re-derived on demand from the
// account mnemonic + gift index. These tests pin the contract:
//   1. Post-cutoff gifts use the Spark scheme (m/8797555'/giftNum'/0').
//   2. Pre-cutoff gifts use the legacy scheme (m/44'/0'/0'/0/giftNum).
//   3. The re-derived value is byte-identical to the value that was previously
//      persisted, so reclaiming still yields the exact same wallet seed.
// ---------------------------------------------------------------------------
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

jest.mock('../../../app/constants', () => ({
  __esModule: true,
  GIFT_DERIVE_PATH_CUTOFF: 1763650239108,
  IS_LETTER_REGEX: /^[A-Za-z]$/,
}));

const {
  deriveGiftRestoreKey,
  deriveSparkGiftMnemonic,
} = require('../../../app/functions/gift/deriveGiftWallet');
const { deriveKeyFromMnemonic } = require('../../../app/functions/seed');

const ACCOUNT_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const CUTOFF = 1763650239108;

describe('deriveGiftRestoreKey', () => {
  test('post-cutoff gifts use the Spark derivation scheme', async () => {
    const giftNum = 1001;
    const expected = (await deriveSparkGiftMnemonic(ACCOUNT_MNEMONIC, giftNum))
      .derivedMnemonic;

    await expect(
      deriveGiftRestoreKey(ACCOUNT_MNEMONIC, giftNum, CUTOFF + 1),
    ).resolves.toBe(expected);
  });

  test('pre-cutoff gifts use the legacy derivation scheme', async () => {
    const giftNum = 42;
    const expected = (await deriveKeyFromMnemonic(ACCOUNT_MNEMONIC, giftNum))
      .derivedMnemonic;

    await expect(
      deriveGiftRestoreKey(ACCOUNT_MNEMONIC, giftNum, CUTOFF - 1),
    ).resolves.toBe(expected);
  });

  test('gifts created exactly at the cutoff use the legacy scheme', async () => {
    const giftNum = 7;
    const expected = (await deriveKeyFromMnemonic(ACCOUNT_MNEMONIC, giftNum))
      .derivedMnemonic;

    await expect(
      deriveGiftRestoreKey(ACCOUNT_MNEMONIC, giftNum, CUTOFF),
    ).resolves.toBe(expected);
  });

  test('is deterministic for identical inputs', async () => {
    const a = await deriveGiftRestoreKey(ACCOUNT_MNEMONIC, 1001, CUTOFF + 1);
    const b = await deriveGiftRestoreKey(ACCOUNT_MNEMONIC, 1001, CUTOFF + 1);
    expect(a).toBe(b);
  });

  test('derives a different key per gift index', async () => {
    const a = await deriveGiftRestoreKey(ACCOUNT_MNEMONIC, 1001, CUTOFF + 1);
    const b = await deriveGiftRestoreKey(ACCOUNT_MNEMONIC, 1002, CUTOFF + 1);
    expect(a).not.toBe(b);
  });

  test('returns a valid 12-word BIP39 mnemonic', async () => {
    const key = await deriveGiftRestoreKey(ACCOUNT_MNEMONIC, 1001, CUTOFF + 1);
    expect(key.split(' ')).toHaveLength(12);
    expect(validateMnemonic(key, wordlist)).toBe(true);
  });

  test('matches the restore key previously persisted by giftContext', async () => {
    // Backwards compatibility: the value giftContext used to persist as
    // `restoreKey` must be exactly what re-deriving on demand produces.
    const giftNum = 1001;
    const previouslyStored = (await deriveSparkGiftMnemonic(
      ACCOUNT_MNEMONIC,
      giftNum,
    )).derivedMnemonic;

    const onDemand = await deriveGiftRestoreKey(
      ACCOUNT_MNEMONIC,
      giftNum,
      CUTOFF + 1,
    );
    expect(onDemand).toBe(previouslyStored);
  });
});
