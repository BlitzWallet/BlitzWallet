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

const { splitAndStoreNWCData } = require('../../app/functions/nwc');
const { setLocalStorageItem } = require('../../app/functions/localStorage');
const { storeData } = require('../../app/functions/secureStore');

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
});
