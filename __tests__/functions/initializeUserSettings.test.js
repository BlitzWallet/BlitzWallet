/**
 * Regression tests for the login-time child-field echo (M1).
 *
 * initializeUserSettingsFromHistory builds a tempObject from a Firestore
 * snapshot and fires it at the DB whenever any unrelated default triggers
 * needsToUpdate. Child fields must NEVER ride that deferred write: a stale
 * childAccounts array would clobber concurrent child creations on other
 * devices, and a stale nextChildDerivationIndex would regress the counter
 * (defeating getNextChildDerivationIndex's max(counter, maxExisting+1) guard).
 * The fields still need to land in LOCAL state — the linked-accounts list and
 * the child spending-limit gate read them from masterInfoObject.
 */

const PUBLIC_KEY = 'parent-pubkey';

const mockSendDataToDB = jest.fn(async () => true);
const mockGetDataFromCollection = jest.fn();
const mockFetchLocalStorageItems = jest.fn();
const mockGetNWCData = jest.fn(async () => ({}));
const mockSetLocalStorageItem = jest.fn();
const mockSetMasterInfoObject = jest.fn();
const mockToggleGlobalContactsInformation = jest.fn();
const mockToggleGlobalAppDataInformation = jest.fn();

jest.mock('../../db', () => ({
  getDataFromCollection: mockGetDataFromCollection,
}));

jest.mock('../../db/interactionManager', () => ({
  sendDataToDB: mockSendDataToDB,
}));

jest.mock('../../db/initializeFirebase', () => ({
  firebaseAuth: { currentUser: null },
  initializeFirebase: jest.fn(async () => {}),
}));

jest.mock('../../app/functions/initializeUserSettingsHelpers', () => ({
  fetchLocalStorageItems: mockFetchLocalStorageItems,
}));

jest.mock('../../app/functions/nwc', () => ({
  getNWCData: mockGetNWCData,
}));

jest.mock('../../app/functions/nwc/wallet', () => ({
  initializeNWCWallet: jest.fn(async () => ({ isConnected: false })),
  getNWCSparkIdentityPubKey: jest.fn(async () => ''),
}));

jest.mock('../../app/functions/localStorage', () => ({
  setLocalStorageItem: mockSetLocalStorageItem,
}));

jest.mock('../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
  crashlyticsRecordErrorReport: jest.fn(),
}));

const initializeUserSettingsFromHistory =
  require('../../app/functions/initializeUserSettings').default;

const childEntry = {
  uuid: 'c1',
  name: 'Kid',
  childIndex: 4,
  spendingLimit: 1000,
};

function baseStoredData() {
  return {
    uuid: PUBLIC_KEY,
    contacts: {
      myProfile: {
        uniqueName: 'parent',
        uniqueNameLower: 'parent',
        name: 'Parent',
        nameLower: 'parent',
        bio: '',
        didEditProfile: true,
        lastRotated: 1,
        lastRotatedAddedContact: 1,
        receiveAddress: null,
      },
      addedContacts: [],
    },
    childAccounts: [childEntry],
    nextChildDerivationIndex: 5,
    isChildAccount: false,
    spendingLimit: null,
  };
}

function baseLocalData() {
  return {
    nwc_identity_pub_key: 'nwc-key',
    userBalanceDenomination: 'sats',
    didViewSeedPhrase: true,
    userSelectedLanguage: 'en',
  };
}

async function runInit(blitzStoredData, localStoredData = baseLocalData()) {
  mockGetDataFromCollection.mockResolvedValue(blitzStoredData);
  mockFetchLocalStorageItems.mockResolvedValue(localStoredData);
  return initializeUserSettingsFromHistory({
    setMasterInfoObject: mockSetMasterInfoObject,
    toggleGlobalContactsInformation: mockToggleGlobalContactsInformation,
    toggleGlobalAppDataInformation: mockToggleGlobalAppDataInformation,
    toggleMasterInfoObject: jest.fn(),
    preloadedData: null,
    setPreLoadedUserData: jest.fn(),
    privateKey: 'priv',
    publicKey: PUBLIC_KEY,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('initializeUserSettings child-field echo', () => {
  test('deferred settings write excludes child fields but still ships real settings', async () => {
    // Stored doc lacks enabledLNURL (and other defaults) -> needsToUpdate.
    const result = await runInit(baseStoredData());

    expect(result.didWork).toBe(true);
    expect(mockSendDataToDB).toHaveBeenCalledTimes(1);

    const payload = mockSendDataToDB.mock.calls[0][0];
    expect(payload).not.toHaveProperty('childAccounts');
    expect(payload).not.toHaveProperty('nextChildDerivationIndex');
    expect(payload).not.toHaveProperty('isChildAccount');
    expect(payload).not.toHaveProperty('spendingLimit');
    // The write still carries the settings that actually changed.
    expect(payload.uuid).toBe(PUBLIC_KEY);
    expect(payload.enabledLNURL).toBe(true);
  });

  test('child fields still land in local masterInfoObject', async () => {
    await runInit(baseStoredData());

    const localState = mockSetMasterInfoObject.mock.calls[0][0];
    expect(localState.childAccounts).toEqual([childEntry]);
    expect(localState.nextChildDerivationIndex).toBe(5);
    expect(localState.isChildAccount).toBe(false);
    expect(localState.spendingLimit).toBeNull();
  });

  test('no deferred write at all when the doc is fully synced', async () => {
    const fullySynced = {
      ...baseStoredData(),
      enabledLNURL: true,
      enabledGiftCards: true,
      ecashWalletSettings: { maxReceiveAmountSat: 10_000, maxEcashBalance: 25_000 },
      pushNotifications: { isEnabled: true, hash: '', key: {}, enabledServices: {} },
      isUsingEncriptedMessaging: true,
      isUsingNewNotifications: true,
      liquidWalletSettings: {
        autoChannelRebalance: true,
        autoChannelReabalancePercantage: 90,
        regulateChannelOpen: true,
        regulatedChannelOpenSize: 2000,
        maxChannelOpenFee: 5000,
        isLightningEnabled: true,
        minAutoSwapAmount: 10000,
      },
    };

    await runInit(fullySynced);

    expect(mockSendDataToDB).not.toHaveBeenCalled();
    expect(mockSetMasterInfoObject).toHaveBeenCalledTimes(1);
  });
});
