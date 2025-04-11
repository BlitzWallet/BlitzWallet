import {QUICK_PAY_STORAGE_KEY} from '../../constants';
import {getLocalStorageItem} from '../localStorage';

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
  };
};
