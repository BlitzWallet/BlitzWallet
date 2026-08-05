jest.mock('../../app/constants', () => ({
  NWC_LOACAL_STORE_KEY: 'NWC_LOACAL_STORE_KEY',
  NWC_SECURE_STORE_KEY: 'NWC_SECURE_STORE_KEY',
}));
jest.mock('../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn(async () => true),
}));
jest.mock('../../app/functions/secureStore', () => ({
  retrieveData: jest.fn(),
  storeData: jest.fn(async () => true),
}));

const { splitAndStoreNWCData, getNWCData } = require('../../app/functions/nwc');
const {
  getLocalStorageItem,
  setLocalStorageItem,
} = require('../../app/functions/localStorage');
const { retrieveData, storeData } = require('../../app/functions/secureStore');
const { getPublicKey } = require('nostr-tools');

describe('splitAndStoreNWCData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('stores flag-only NWC data when there are no accounts', async () => {
    await expect(
      splitAndStoreNWCData({ shouldEncryptNWCContent: false }),
    ).resolves.toBeUndefined();

    expect(storeData).toHaveBeenCalledWith(
      'NWC_SECURE_STORE_KEY',
      JSON.stringify({}),
    );
    expect(setLocalStorageItem).toHaveBeenCalledWith(
      'NWC_LOACAL_STORE_KEY',
      JSON.stringify({ shouldEncryptNWCContent: false }),
    );
  });

  test('splits sensitive account keys out of local storage', async () => {
    await splitAndStoreNWCData({
      shouldEncryptNWCContent: false,
      accounts: {
        abc: {
          accountName: 'Main',
          privateKey: 'pk',
          secret: 'sec',
          publicKey: 'abc',
        },
      },
    });

    expect(storeData).toHaveBeenCalledWith(
      'NWC_SECURE_STORE_KEY',
      JSON.stringify({
        abc: { privateKey: 'pk', secret: 'sec' },
      }),
    );
    expect(setLocalStorageItem).toHaveBeenCalledWith(
      'NWC_LOACAL_STORE_KEY',
      JSON.stringify({
        shouldEncryptNWCContent: false,
        accounts: { abc: { accountName: 'Main', publicKey: 'abc' } },
      }),
    );
  });

  test('backfills clientPubkey from the stored secret for existing accounts', async () => {
    const secret = '01'.repeat(32);
    getLocalStorageItem.mockResolvedValue(
      JSON.stringify({
        accounts: {
          abc: { accountName: 'Main', publicKey: 'abc' },
        },
      }),
    );
    retrieveData.mockResolvedValue({
      value: JSON.stringify({ abc: { privateKey: 'pk', secret } }),
    });

    const data = await getNWCData();

    expect(data.accounts.abc.clientPubkey).toBe(getPublicKey(secret));
    expect(setLocalStorageItem).toHaveBeenCalledWith(
      'NWC_LOACAL_STORE_KEY',
      expect.stringContaining(getPublicKey(secret)),
    );
  });
});
