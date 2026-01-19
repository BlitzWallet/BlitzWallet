import { NWC_IDENTITY_PUB_KEY, QUICK_PAY_STORAGE_KEY } from '../../constants';
import { BLITZ_FEE_PERCET, BLITZ_FEE_SATS } from '../../constants/math';
import { getLocalStorageItem } from '../localStorage';
import { isNewDaySince } from '../rotateAddressDateChecker';

const keys = [
  'homepageTxPreferance',
  'enabledSlidingCamera',
  'userFaceIDPereferance',
  'fiatCurrenciesList',
  'failedTransactions',
  'satDisplay',
  'enabledEcash',
  'hideUnknownContacts',
  'useTrampoline',
  QUICK_PAY_STORAGE_KEY,
  'crashReportingSettings',
  'enabledDeveloperSupport',
  'didViewNWCMessage',
  'userSelectedLanguage',
  NWC_IDENTITY_PUB_KEY,
  'userBalanceDenomination',
  'didViewSeedPhrase',
  'enabledBTKNTokens',
  'defaultSpendToken',
  'thousandsSeperator',
];

const defaultValues = {
  homepageTxPreferance: 25,
  enabledSlidingCamera: false,
  userFaceIDPereferance: false,
  fiatCurrenciesList: [],
  failedTransactions: [],
  satDisplay: 'word',
  enabledEcash: false,
  hideUnknownContacts: false,
  useTrampoline: true,
  [QUICK_PAY_STORAGE_KEY]: {
    isFastPayEnabled: false,
    fastPayThresholdSats: 5000,
  },
  crashReportingSettings: {
    isCrashReportingEnabled: true,
    lastChangedInSettings: new Date().getTime(),
    lastChangedWithFirebase: new Date().getTime(),
  },
  enabledDeveloperSupport: {
    isEnabled: true,
    baseFee: BLITZ_FEE_SATS,
    baseFeePercent: BLITZ_FEE_PERCET,
  },
  didViewNWCMessage: false,
  userSelectedLanguage: 'en',
  [NWC_IDENTITY_PUB_KEY]: '',
  userBalanceDenomination: '',
  didViewSeedPhrase: null,
  enabledBTKNTokens: null,
  defaultSpendToken: 'Bitcoin',
  thousandsSeperator: 'space',
};

export const fetchLocalStorageItems = async () => {
  const results = await Promise.all(keys.map(key => getLocalStorageItem(key)));

  const parsedResults = results.map((value, index) => {
    try {
      return JSON.parse(value);
    } catch {
      return defaultValues[keys[index]]; // Fallback to default if parsing fails
    }
  });

  return {
    storedUserTxPereferance:
      parsedResults[0] || defaultValues.homepageTxPreferance,
    enabledSlidingCamera:
      parsedResults[1] ?? defaultValues.enabledSlidingCamera,
    userFaceIDPereferance:
      parsedResults[2] ?? defaultValues.userFaceIDPereferance,
    fiatCurrenciesList: parsedResults[3] || defaultValues.fiatCurrenciesList,
    failedTransactions: parsedResults[4] || defaultValues.failedTransactions,
    satDisplay: parsedResults[5] || defaultValues.satDisplay,
    enabledEcash: parsedResults[6] ?? defaultValues.enabledEcash,
    hideUnknownContacts: parsedResults[7] ?? defaultValues.hideUnknownContacts,
    useTrampoline: parsedResults[8] ?? defaultValues.useTrampoline,
    fastPaySettings: parsedResults[9] ?? defaultValues[QUICK_PAY_STORAGE_KEY],
    crashReportingSettings:
      parsedResults[10] ?? defaultValues.crashReportingSettings,
    enabledDeveloperSupport:
      parsedResults[11] ?? defaultValues.enabledDeveloperSupport,
    didViewNWCMessage: parsedResults[12] ?? defaultValues.didViewNWCMessage,
    userSelectedLanguage:
      parsedResults[13] ?? defaultValues.userSelectedLanguage,
    nwc_identity_pub_key:
      parsedResults[14] ?? defaultValues[NWC_IDENTITY_PUB_KEY],
    userBalanceDenomination:
      parsedResults[15] ?? defaultValues.userBalanceDenomination,
    didViewSeedPhrase: parsedResults[16] ?? defaultValues.didViewSeedPhrase,
    enabledBTKNTokens: parsedResults[17] ?? defaultValues.enabledBTKNTokens,
    defaultSpendToken: parsedResults[18] ?? defaultValues.defaultSpendToken,
    thousandsSeperator: parsedResults[19] ?? defaultValues.thousandsSeperator,
  };
};

export function shouldLoadExploreData(savedExploreRawData, currentServerTime) {
  let shouldFetchUserCount = false;

  try {
    if (!savedExploreRawData?.lastUpdated) {
      return true;
    }

    const UTC_MINUS_6_OFFSET = -6;

    // Calculate the next 12 PM UTC-6 after the last update
    const lastUpdateTimezoneMs =
      savedExploreRawData.lastUpdated -
      1000 * 60 * 60 * 12 +
      UTC_MINUS_6_OFFSET * 60 * 60 * 1000;
    const lastUpdateDate = new Date(lastUpdateTimezoneMs);
    lastUpdateDate.setUTCHours(12, 0, 0, 0);

    let next12PMAfterLastUpdate = lastUpdateDate.getTime();

    // If last update was after 12 PM on that day, move to next day's 12 PM
    if (savedExploreRawData.lastUpdated >= next12PMAfterLastUpdate) {
      next12PMAfterLastUpdate += 24 * 60 * 60 * 1000; // Add one day
    }

    // Check if we've passed the next 12 PM UTC-6 after the last update
    if (currentServerTime >= next12PMAfterLastUpdate) {
      shouldFetchUserCount = true;
    }
  } catch (err) {
    console.log('error in should load explore data', err);
    // Default to fetching on error to be safe
    shouldFetchUserCount = true;
  }

  return shouldFetchUserCount;
}
