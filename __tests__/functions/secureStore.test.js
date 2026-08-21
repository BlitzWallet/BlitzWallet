/* eslint-env jest */
// Focused unit tests for the onboarding-wipe keychain work:
//  - wipeStaleWalletKeychain: the scrub must delete every stale previous-wallet
//    secure-store item (NWC seed + connection data, biometric key, login-security
//    mode, and legacy pre-migration pin/mnemonic under both keychain services)
//    while always keeping the freshly written pinHash + encryptedMnemonic AND
//    the wipe re-arm marker. Custody accounts live in AsyncStorage (localStorage),
//    so the keychain scrub correctly leaves them alone.
//  - arm/is/disarmWipeInProgress: the keychain-backed wipeInProgress marker that
//    re-arms a failed/killed wipe on the next launch. Must survive the scrub,
//    fail closed when unreadable, and disarm must verify the delete really
//    happened (iOS deleteItemAsync ignores the SecItemDelete status).

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

const {
  wipeStaleWalletKeychain,
  armWipeInProgress,
  isWipeInProgress,
  disarmWipeInProgress,
  WIPE_IN_PROGRESS_KEY,
} = require('../../app/functions/secureStore');
const {
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
} = require('expo-secure-store');
const {
  BIOMETRIC_KEY,
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

    expect(deleteItemAsync).toHaveBeenCalledTimes(8);
    for (const key of [
      BIOMETRIC_KEY,
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
    // The wipe re-arm marker must survive the scrub: a failure AFTER the scrub
    // (re-init, process kill) still needs it armed for the next launch.
    expect(deletedKeys).not.toContain(WIPE_IN_PROGRESS_KEY);
  });

  test('returns false when a deleteItemAsync call rejects', async () => {
    deleteItemAsync.mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(wipeStaleWalletKeychain()).resolves.toBe(false);
  });
});

describe('wipe re-arm marker (wipeInProgress)', () => {
  const keychainOptions = expect.objectContaining({
    keychainService: SHARED_KEYCHAIN_SERVICE,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('armWipeInProgress writes the marker to the shared keychain', async () => {
    await expect(armWipeInProgress()).resolves.toBe(true);
    expect(setItemAsync).toHaveBeenCalledWith(
      WIPE_IN_PROGRESS_KEY,
      'true',
      keychainOptions,
    );
  });

  test('armWipeInProgress returns false when the keychain write fails', async () => {
    setItemAsync.mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(armWipeInProgress()).resolves.toBe(false);
  });

  test('isWipeInProgress returns true while the marker is present', async () => {
    getItemAsync.mockResolvedValueOnce('true');

    await expect(isWipeInProgress()).resolves.toBe(true);
  });

  test('isWipeInProgress returns false when the marker is absent', async () => {
    getItemAsync.mockResolvedValueOnce(null);

    await expect(isWipeInProgress()).resolves.toBe(false);
  });

  test('isWipeInProgress non blocking when the keychain read throws', async () => {
    getItemAsync.mockRejectedValueOnce(new Error('device locked'));

    await expect(isWipeInProgress()).resolves.toBe(false);
  });

  test('disarmWipeInProgress deletes the marker and verifies removal', async () => {
    getItemAsync.mockResolvedValueOnce(null);

    await expect(disarmWipeInProgress()).resolves.toBe(true);
    expect(deleteItemAsync).toHaveBeenCalledWith(
      WIPE_IN_PROGRESS_KEY,
      keychainOptions,
    );
    expect(getItemAsync).toHaveBeenCalledWith(
      WIPE_IN_PROGRESS_KEY,
      keychainOptions,
    );
  });

  test('disarmWipeInProgress returns false when the marker survives the delete', async () => {
    // deleteItemAsync on iOS resolves even when SecItemDelete failed, so the
    // verification read still sees the marker: the wipe must report failure.
    getItemAsync.mockResolvedValueOnce('true');

    await expect(disarmWipeInProgress()).resolves.toBe(false);
  });

  test('disarmWipeInProgress returns false when the delete rejects', async () => {
    deleteItemAsync.mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(disarmWipeInProgress()).resolves.toBe(false);
  });

  test('disarmWipeInProgress returns false when the verification read throws', async () => {
    getItemAsync.mockRejectedValueOnce(new Error('device locked'));

    await expect(disarmWipeInProgress()).resolves.toBe(false);
  });
});
