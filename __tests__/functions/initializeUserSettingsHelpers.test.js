/* eslint-env jest */
jest.mock('../../app/constants', () => ({
  NWC_IDENTITY_PUB_KEY: 'NWC_WALLET_PUB_KEY',
  QUICK_PAY_STORAGE_KEY: 'FAST_PAY_SETTINGS',
  SPEND_AND_REPLACE_STORAGE_KEY: 'spendAndReplace',
}));
jest.mock('../../app/functions/localStorage', () => ({
  getMultipleItems: jest.fn(),
}));

const {
  fetchLocalStorageItems,
} = require('../../app/functions/initializeUserSettingsHelpers');
const {
  getMultipleItems,
} = require('../../app/functions/localStorage');

const expectedDefaults = () => ({
  storedUserTxPereferance: 25,
  enabledSlidingCamera: false,
  userFaceIDPereferance: false,
  fiatCurrenciesList: [],
  failedTransactions: [],
  satDisplay: 'symbol',
  enabledEcash: false,
  hideUnknownContacts: false,
  useTrampoline: true,
  fastPaySettings: { isFastPayEnabled: false, fastPayThresholdSats: 5000 },
  crashReportingSettings: expect.objectContaining({
    isCrashReportingEnabled: true,
    lastChangedInSettings: expect.any(Number),
    lastChangedWithFirebase: expect.any(Number),
  }),
  enabledDeveloperSupport: expect.objectContaining({
    isEnabled: true,
    baseFee: 4,
    baseFeePercent: 0.004,
  }),
  didViewNWCMessage: false,
  userSelectedLanguage: 'en',
  nwc_identity_pub_key: '',
  userBalanceDenomination: '',
  didViewSeedPhrase: null,
  enabledBTKNTokens: null,
  defaultSpendToken: 'Bitcoin',
  thousandsSeperator: 'space',
  enabledLiquidAutoSwap: true,
  pinnedAccounts: [],
  monthlyBudget: null,
  bitrefillEmail: '',
  spendAndReplace: { isEnabled: false },
  hideSmallPaymentsHomepage: false,
});

describe('fetchLocalStorageItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('parses mixed multiGet output and applies defaults', async () => {
    getMultipleItems.mockImplementation(async keys =>
      keys.map((key, index) => {
        switch (index) {
          case 0:
            return [key, '50'];
          case 3:
            return [key, '["USD"]'];
          case 5:
            return [key, '{malformed'];
          case 9:
            return [key, '{"isFastPayEnabled":true,"fastPayThresholdSats":100}'];
          case 13:
            return [key, '"es"'];
          case 21:
            return [key, '["account-a","account-b"]'];
          default:
            return [key, null];
        }
      }),
    );

    const result = await fetchLocalStorageItems();

    expect(result).toEqual({
      ...expectedDefaults(),
      storedUserTxPereferance: 50,
      fiatCurrenciesList: ['USD'],
      satDisplay: 'symbol',
      fastPaySettings: {
        isFastPayEnabled: true,
        fastPayThresholdSats: 100,
      },
      userSelectedLanguage: 'es',
      pinnedAccounts: ['account-a', 'account-b'],
    });
  });

  test('falls back to all defaults when multiGet fails ([])', async () => {
    getMultipleItems.mockResolvedValue([]);

    const result = await fetchLocalStorageItems();

    expect(result).toEqual(expectedDefaults());
  });
});
