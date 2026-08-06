/* eslint-env jest */
// Focused unit tests for wipeStaleWalletKeychain: the onboarding-wipe keychain
// scrub must delete every stale previous-wallet secure-store item (NWC seed +
// connection data, biometric key, custody accounts, login-security mode, and
// legacy pre-migration pin/mnemonic under both keychain services) while always
// keeping the freshly written pinHash + encryptedMnemonic.

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  deleteItemAsync: jest.fn(async () => true),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => true),
}));

jest.mock('../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn(async () => null),
  removeAllLocalData: jest.fn(async () => true),
  setLocalStorageItem: jest.fn(async () => true),
}));

jest.mock('../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
  crashlyticsRecordErrorReport: jest.fn(),
}));

const { wipeStaleWalletKeychain } = require('../../app/functions/secureStore');
const { deleteItemAsync } = require('expo-secure-store');
const {
  BIOMETRIC_KEY,
  CUSTODY_ACCOUNTS_STORAGE_KEY,
  LOGIN_SECURITY_MODE_TYPE_KEY,
  NWC_SECURE_STORE_KEY,
  NWC_SECURE_STORE_MNEMOINC,
} = require('../../app/constants');

const SHARED_KEYCHAIN_SERVICE = '38WX44YTA6.com.blitzwallet.SharedKeychain';

describe('wipeStaleWalletKeychain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deletes every stale key and never pinHash or encryptedMnemonic', async () => {
    await expect(wipeStaleWalletKeychain()).resolves.toBe(true);

    const keychainOptions = expect.objectContaining({
      keychainService: SHARED_KEYCHAIN_SERVICE,
    });

    expect(deleteItemAsync).toHaveBeenCalledTimes(9);
    for (const key of [
      BIOMETRIC_KEY,
      CUSTODY_ACCOUNTS_STORAGE_KEY,
      LOGIN_SECURITY_MODE_TYPE_KEY,
      NWC_SECURE_STORE_MNEMOINC,
      NWC_SECURE_STORE_KEY,
    ]) {
      expect(deleteItemAsync).toHaveBeenCalledWith(key, keychainOptions);
    }
    // Legacy pre-migration entries under both the default service and the
    // shared keychain service (V1 migration + V2 migration).
    expect(deleteItemAsync).toHaveBeenCalledWith('pin');
    expect(deleteItemAsync).toHaveBeenCalledWith('mnemonic');
    expect(deleteItemAsync).toHaveBeenCalledWith('pin', keychainOptions);
    expect(deleteItemAsync).toHaveBeenCalledWith('mnemonic', keychainOptions);

    const deletedKeys = deleteItemAsync.mock.calls.map(([key]) => key);
    expect(deletedKeys).not.toContain('pinHash');
    expect(deletedKeys).not.toContain('encryptedMnemonic');
  });

  test('returns false when a deleteItemAsync call rejects', async () => {
    deleteItemAsync.mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(wipeStaleWalletKeychain()).resolves.toBe(false);
  });
});
