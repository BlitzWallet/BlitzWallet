jest.mock('../../db', () => ({
  getDataFromCollection: jest.fn(),
}));
jest.mock('../../db/interactionManager', () => ({
  sendDataToDB: jest.fn(async () => true),
}));
jest.mock('../../db/initializeFirebase', () => ({
  firebaseAuth: { currentUser: { uid: 'user-123' } },
  initializeFirebase: jest.fn(async () => true),
}));
jest.mock('../../app/functions/initializeUserSettingsHelpers', () => ({
  fetchLocalStorageItems: jest.fn(async () => ({})),
}));
jest.mock('../../app/functions/contacts', () => ({
  generateRandomContact: jest.fn(() => ({ uniqueName: 'random' })),
}));
jest.mock('../../app/functions/rotateAddressDateChecker', () => ({
  getCurrentDateFormatted: jest.fn(() => '2026-08-05'),
  getDateXDaysAgo: jest.fn(() => '2026-07-14'),
}));
jest.mock('../../app/constants', () => ({
  MIN_CHANNEL_OPEN_FEE: 1000,
  NWC_IDENTITY_PUB_KEY: 'NWC_WALLET_PUB_KEY',
  QUICK_PAY_STORAGE_KEY: 'FAST_PAY_SETTINGS',
  SPEND_AND_REPLACE_STORAGE_KEY: 'spendAndReplace',
}));
jest.mock('../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
}));
jest.mock('../../app/functions/localStorage', () => ({
  setLocalStorageItem: jest.fn(async () => true),
}));
jest.mock('../../app/functions/nwc', () => ({
  getNWCData: jest.fn(),
}));
jest.mock('../../app/functions/nwc/wallet', () => ({
  getNWCSparkIdentityPubKey: jest.fn(async () => 'pubkey'),
  initializeNWCWallet: jest.fn(async () => ({ isConnected: false })),
}));

const initializeUserSettingsFromHistory =
  require('../../app/functions/initializeUserSettings').default;
const { getDataFromCollection } = require('../../db');
const { getNWCData } = require('../../app/functions/nwc');

describe('initializeUserSettings NWC encryption flag', () => {
  const baseArgs = {
    setMasterInfoObject: jest.fn(),
    toggleGlobalContactsInformation: jest.fn(),
    toggleGlobalAppDataInformation: jest.fn(),
    toggleMasterInfoObject: jest.fn(),
    toggleNWCInformation: jest.fn(async () => true),
    preloadedData: null,
    setPreLoadedUserData: jest.fn(),
    privateKey: 'priv',
    publicKey: 'user-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getDataFromCollection.mockResolvedValue({});
    getNWCData.mockResolvedValue({});
  });

  test('adds shouldEncryptNWCContent=false to the backend NWC object when missing', async () => {
    getNWCData.mockResolvedValue({
      accounts: {
        abc: { accountName: 'Main', permissions: { getBalance: true } },
      },
    });

    const result = await initializeUserSettingsFromHistory(baseArgs);

    expect(result).toBe(true);
    expect(baseArgs.toggleNWCInformation).toHaveBeenCalledTimes(1);
    expect(baseArgs.toggleNWCInformation).toHaveBeenCalledWith(
      expect.objectContaining({ shouldEncryptNWCContent: false }),
    );

    const masterInfoObject = baseArgs.setMasterInfoObject.mock.calls[0][0];
    expect(masterInfoObject.NWC.shouldEncryptNWCContent).toBe(false);
  });

  test('does not rewrite the backend NWC object when flag is already set', async () => {
    getNWCData.mockResolvedValue({ shouldEncryptNWCContent: false });

    await initializeUserSettingsFromHistory(baseArgs);

    expect(baseArgs.toggleNWCInformation).not.toHaveBeenCalled();
  });

  test('overwrites a stale true flag with false', async () => {
    getNWCData.mockResolvedValue({ shouldEncryptNWCContent: true });

    await initializeUserSettingsFromHistory(baseArgs);

    expect(baseArgs.toggleNWCInformation).toHaveBeenCalledTimes(1);
    expect(baseArgs.toggleNWCInformation).toHaveBeenCalledWith(
      expect.objectContaining({ shouldEncryptNWCContent: false }),
    );
  });
});
