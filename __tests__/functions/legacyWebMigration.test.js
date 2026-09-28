/* eslint-env jest */
// ---------------------------------------------------------------------------
// Legacy blitz-web-app → this app, one-time migration.
//
// The fixtures below are NOT hand-written: they were produced by running the
// legacy repo's own crypto-js / crypto-es against a known mnemonic, exactly as
// authContext.jsx (`walletKey`) and activeAccount.jsx (`CUSTODY_ACCOUNTS`)
// write them — including the JSON.stringify the legacy Storage helper applied
// to every value. So this suite checks the migration against genuine
// production output, not against our own idea of the format.
// ---------------------------------------------------------------------------

// In-memory expo-secure-store so the new envelope is really written and really
// read back — the round trip is the point of the test.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
    WHEN_UNLOCKED: 'whenUnlocked',
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
    deleteItemAsync: jest.fn(async key => {
      store.delete(key);
    }),
    __store: store,
  };
});

// jest.setup's crashlytics stub has no named `log`/`recordError`, so the real
// helper throws — and localStorage.js swallows that as a failed write. Stub it
// so the storage helpers under test actually run.
jest.mock('../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
  crashlyticsRecordErrorReport: jest.fn(),
}));

const secureStoreMock = require('expo-secure-store');
const {
  migrateLegacyWallet,
  LEGACY_WALLET_KEY,
} = require('../../app/functions/legacyWebMigration');
const { decryptMnemonicWithPin } = require('../../app/functions/handleMnemonic');
const {
  loadCustodyAccounts,
  resetCustodyCryptoState,
} = require('../../app/functions/custodyAccountsCrypto');
const {
  getLocalStorageItem,
  setLocalStorageItem,
  removeAllLocalData,
} = require('../../app/functions/localStorage');
const { CUSTODY_ACCOUNTS_STORAGE_KEY } = require('../../app/constants');

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'correct horse battery staple';

// CryptoJS.AES.encrypt(MNEMONIC, PASSWORD).toString(), then JSON.stringify'd.
const LEGACY_WALLET_VALUE =
  '"U2FsdGVkX19M0ciAx6RZhVnvNaQ16WWt02HxwK9vDYv7Ryow6pP7TYIm2bFJhr0K/B59sIBVzm+Cm2hYeaf1M137ioQzrK4HU8dKHbJKsDqHKht18EtFfCE3ctR9FDKwmoUP5mmfiPwswNB7M7cL2Q=="';

const LEGACY_ACCOUNT = {
  uuid: 'imported-1',
  name: 'Imported account',
  accountType: 'imported',
  mnemoinc:
    'legal winner thank year wave sausage worth useful legal winner thank yellow',
};

// [CryptoES.AES.encrypt(JSON.stringify(LEGACY_ACCOUNT), MNEMONIC).toString()]
const LEGACY_CUSTODY_VALUE =
  '["U2FsdGVkX1+S9M05dEJPqtHtmhyuVvc4dLBo9el55Aggew00QcKA4dBBxU+tzvhUoCQZobER2t18TrYLNuIc6jjnrW53lh5DHaQIlbPif93qmW14CCDRNhZYub+BKCUp4psfn3kvy3yJbQsTpvzFVb50rX/MPEqUKdz+iE1CJi644X1QuxW9vj8Qk3YdhiTJxr2iRUI2Mu3526r8vqkeZCrCVyqfsyBgNOjPN15ypWupCi2DwCw7S70izBa0vAKc"]';

async function seedLegacyStorage() {
  await setLocalStorageItem(LEGACY_WALLET_KEY, LEGACY_WALLET_VALUE);
  await setLocalStorageItem(CUSTODY_ACCOUNTS_STORAGE_KEY, LEGACY_CUSTODY_VALUE);
  // A legacy-only key with the legacy double-serialized shape.
  await setLocalStorageItem('swapPoolInfo', '"{\\"pool\\":1}"');
}

beforeEach(async () => {
  await removeAllLocalData();
  secureStoreMock.__store.clear();
  resetCustodyCryptoState();
});

test('migrates a real legacy wallet and hands it to the production login path', async () => {
  await seedLegacyStorage();

  const result = await migrateLegacyWallet(PASSWORD);
  expect(result).toEqual({ status: 'ok', mnemonic: MNEMONIC });

  // The envelope the migration wrote must open with the same password through
  // the reader the login screen actually uses.
  await expect(decryptMnemonicWithPin(JSON.stringify(PASSWORD))).resolves.toBe(
    MNEMONIC,
  );

  // Custody accounts survive, re-encrypted out of the legacy format.
  const storedCustody = await getLocalStorageItem(CUSTODY_ACCOUNTS_STORAGE_KEY);
  expect(storedCustody).not.toBe(LEGACY_CUSTODY_VALUE);
  resetCustodyCryptoState();
  await expect(loadCustodyAccounts(storedCustody, MNEMONIC)).resolves.toEqual([
    LEGACY_ACCOUNT,
  ]);

  // Everything else legacy is gone.
  expect(await getLocalStorageItem(LEGACY_WALLET_KEY)).toBeNull();
  expect(await getLocalStorageItem('swapPoolInfo')).toBeNull();
});

test('a wrong password changes nothing', async () => {
  await seedLegacyStorage();

  const result = await migrateLegacyWallet('not the password');
  expect(result.status).toBe('wrong-password');

  expect(await getLocalStorageItem(LEGACY_WALLET_KEY)).toBe(
    LEGACY_WALLET_VALUE,
  );
  expect(await getLocalStorageItem(CUSTODY_ACCOUNTS_STORAGE_KEY)).toBe(
    LEGACY_CUSTODY_VALUE,
  );
  expect(await getLocalStorageItem('swapPoolInfo')).not.toBeNull();
  expect(secureStoreMock.__store.get('encryptedMnemonic')).toBeUndefined();
});

test('nothing is deleted when the new envelope cannot be stored', async () => {
  await seedLegacyStorage();
  secureStoreMock.setItemAsync.mockRejectedValueOnce(new Error('quota'));

  const result = await migrateLegacyWallet(PASSWORD);
  expect(result.status).toBe('failed');

  expect(await getLocalStorageItem(LEGACY_WALLET_KEY)).toBe(
    LEGACY_WALLET_VALUE,
  );
  expect(await getLocalStorageItem('swapPoolInfo')).not.toBeNull();
});

// Swaps the stored envelope right after storeMnemonicWithPinSecurity's
// byte-exact read-back passed (the pinHash marker is written next), so only a
// real decrypt can notice. This is the gap a string-compare read-back misses.
function replaceEnvelopeAfterReadback(makeEnvelope) {
  const store = secureStoreMock.__store;
  secureStoreMock.setItemAsync.mockImplementationOnce(async (key, value) => {
    store.set(key, value); // encryptedMnemonic, written as normal
  });
  secureStoreMock.setItemAsync.mockImplementationOnce(async (key, value) => {
    store.set(key, value); // pinHash
    store.set(
      'encryptedMnemonic',
      makeEnvelope(store.get('encryptedMnemonic')),
    );
  });
}

async function expectLegacyUntouched() {
  expect(await getLocalStorageItem(LEGACY_WALLET_KEY)).toBe(
    LEGACY_WALLET_VALUE,
  );
  // loadCustodyAccounts upgrades the list in place on read (before the seed is
  // stored), so check it is still recoverable rather than byte-identical.
  resetCustodyCryptoState();
  await expect(
    loadCustodyAccounts(
      await getLocalStorageItem(CUSTODY_ACCOUNTS_STORAGE_KEY),
      MNEMONIC,
    ),
  ).resolves.toEqual([LEGACY_ACCOUNT]);
  expect(await getLocalStorageItem('swapPoolInfo')).not.toBeNull();
}

test('nothing is deleted when the stored envelope cannot be decrypted', async () => {
  await seedLegacyStorage();
  replaceEnvelopeAfterReadback(envelope => {
    const env = JSON.parse(envelope);
    const tag = Buffer.from(env.tag, 'base64');
    tag[0] ^= 0xff;
    return JSON.stringify({ ...env, tag: tag.toString('base64') });
  });

  const result = await migrateLegacyWallet(PASSWORD);
  expect(result).toEqual({ status: 'failed' });

  await expectLegacyUntouched();
});

test('nothing is deleted when the envelope decrypts to a different seed', async () => {
  const {
    storeMnemonicWithPinSecurity,
  } = require('../../app/functions/handleMnemonic');
  // A genuine envelope under the same password, but for another seed.
  await storeMnemonicWithPinSecurity(LEGACY_ACCOUNT.mnemoinc, PASSWORD);
  const otherEnvelope = secureStoreMock.__store.get('encryptedMnemonic');
  secureStoreMock.__store.clear();

  await seedLegacyStorage();
  replaceEnvelopeAfterReadback(() => otherEnvelope);

  const result = await migrateLegacyWallet(PASSWORD);
  expect(result).toEqual({ status: 'failed' });

  await expectLegacyUntouched();
});

test('a failed verify can be retried and then succeeds', async () => {
  await seedLegacyStorage();
  replaceEnvelopeAfterReadback(() => '{"v":3,"garbage":true}');

  expect((await migrateLegacyWallet(PASSWORD)).status).toBe('failed');
  await expectLegacyUntouched();

  await expect(migrateLegacyWallet(PASSWORD)).resolves.toEqual({
    status: 'ok',
    mnemonic: MNEMONIC,
  });
  expect(await getLocalStorageItem(LEGACY_WALLET_KEY)).toBeNull();
});
