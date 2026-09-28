const { Platform } = require('react-native');

const mockRetrieveData = jest.fn();
const mockStoreData = jest.fn();
const mockDeriveKeyFromMnemonic = jest.fn();
const mockDeriveSparkIdentityKey = jest.fn();

jest.mock('../../../app/functions/secureStore', () => ({
  retrieveData: (...a) => mockRetrieveData(...a),
  storeData: (...a) => mockStoreData(...a),
}));
jest.mock('../../../app/functions/seed', () => ({
  deriveKeyFromMnemonic: (...a) => mockDeriveKeyFromMnemonic(...a),
}));
jest.mock('../../../app/functions/gift/deriveGiftWallet', () => ({
  deriveSparkIdentityKey: (...a) => mockDeriveSparkIdentityKey(...a),
}));

const { ensureNWCSeed } = require('../../../app/functions/nwc/ensureNWCSeed');
const { NWC_SECURE_STORE_MNEMOINC } = require('../../../app/constants');

const MAIN = 'main mnemonic';
const NWC_SEED = 'nwc seed words';
const ORIGINAL_OS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
  mockRetrieveData.mockResolvedValue({ didWork: true, value: null });
  mockStoreData.mockResolvedValue(true);
  mockDeriveKeyFromMnemonic.mockResolvedValue({
    success: true,
    derivedMnemonic: NWC_SEED,
  });
  mockDeriveSparkIdentityKey.mockResolvedValue({
    success: true,
    publicKeyHex: 'nwc-pub',
  });
});

afterAll(() => {
  Platform.OS = ORIGINAL_OS;
});

test('web: does nothing', async () => {
  Platform.OS = 'web';
  await expect(ensureNWCSeed(MAIN, undefined)).resolves.toBeNull();
  expect(mockRetrieveData).not.toHaveBeenCalled();
  expect(mockStoreData).not.toHaveBeenCalled();
});

test('seed and key already present: no work', async () => {
  mockRetrieveData.mockResolvedValue({ didWork: true, value: NWC_SEED });
  await expect(ensureNWCSeed(MAIN, 'nwc-pub')).resolves.toBeNull();
  expect(mockDeriveKeyFromMnemonic).not.toHaveBeenCalled();
  expect(mockDeriveSparkIdentityKey).not.toHaveBeenCalled();
});

test('no seed: derives index 2, stores it, returns account-1 identity key', async () => {
  await expect(ensureNWCSeed(MAIN, undefined)).resolves.toBe('nwc-pub');
  expect(mockDeriveKeyFromMnemonic).toHaveBeenCalledWith(MAIN, 2);
  expect(mockStoreData).toHaveBeenCalledWith(NWC_SECURE_STORE_MNEMOINC, NWC_SEED);
  expect(mockDeriveSparkIdentityKey).toHaveBeenCalledWith(NWC_SEED, 1);
});

test('no seed but a stale key: still derives and returns a fresh key', async () => {
  await expect(ensureNWCSeed(MAIN, 'old-pub')).resolves.toBe('nwc-pub');
  expect(mockStoreData).toHaveBeenCalledTimes(1);
});

test('seed present, key missing: backfills key without touching the seed', async () => {
  mockRetrieveData.mockResolvedValue({ didWork: true, value: NWC_SEED });
  await expect(ensureNWCSeed(MAIN, '')).resolves.toBe('nwc-pub');
  expect(mockDeriveKeyFromMnemonic).not.toHaveBeenCalled();
  expect(mockStoreData).not.toHaveBeenCalled();
  expect(mockDeriveSparkIdentityKey).toHaveBeenCalledWith(NWC_SEED, 1);
});

test('missing main mnemonic: throws, stores nothing', async () => {
  await expect(ensureNWCSeed('', undefined)).rejects.toThrow();
  expect(mockDeriveKeyFromMnemonic).not.toHaveBeenCalled();
  expect(mockStoreData).not.toHaveBeenCalled();
});

test('seed derivation fails: throws, stores nothing', async () => {
  mockDeriveKeyFromMnemonic.mockResolvedValue({ success: false, error: 'x' });
  await expect(ensureNWCSeed(MAIN, undefined)).rejects.toThrow();
  expect(mockStoreData).not.toHaveBeenCalled();
});

test('seed store fails: throws, never returns a key', async () => {
  mockStoreData.mockResolvedValue(false);
  await expect(ensureNWCSeed(MAIN, undefined)).rejects.toThrow();
  expect(mockDeriveSparkIdentityKey).not.toHaveBeenCalled();
});

test('identity derivation fails: throws', async () => {
  mockDeriveSparkIdentityKey.mockResolvedValue({ success: false });
  await expect(ensureNWCSeed(MAIN, undefined)).rejects.toThrow();
});

test('keychain read fails: throws, never overwrites the seed', async () => {
  mockRetrieveData.mockResolvedValue({ didWork: false, value: false });
  await expect(ensureNWCSeed(MAIN, undefined)).rejects.toThrow();
  expect(mockDeriveKeyFromMnemonic).not.toHaveBeenCalled();
  expect(mockStoreData).not.toHaveBeenCalled();
});
