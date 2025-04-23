import {addDataToCollection} from '.';
import {QUICK_PAY_STORAGE_KEY} from '../app/constants';
import {setLocalStorageItem} from '../app/functions';

const PRESET_LOCAL_DATA = {
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
  boltzClaimTxs: [],
  savedLiquidSwaps: [],
  cachedContactsList: [],
  liquidSwaps: [],
  crashReportingSettings: {
    isCrashReportingEnabled: true,
    lastChangedInSettings: new Date().getTime(),
    lastChangedWithFirebase: new Date().getTime(),
  },
  exploreData: {
    lastUpdated: new Date().getTime(),
    data: null,
  },
};

async function sendDataToDB(newObject, uuid) {
  try {
    const localStorageData = {};
    const dbStorageData = {...newObject};

    Object.keys(newObject).forEach(key => {
      if (Object.keys(PRESET_LOCAL_DATA).includes(key)) {
        localStorageData[key] = newObject[key];
        delete dbStorageData[key];
      }
    });

    if (Object.keys(localStorageData).length > 0) {
      const localStoragePromises = Object.entries(localStorageData).map(
        ([key, value]) => setLocalStorageItem(key, JSON.stringify(value)),
      );
      await Promise.all(localStoragePromises);
    }

    if (Object.keys(dbStorageData).length > 0) {
      await addDataToCollection(dbStorageData, 'blitzWalletUsers', uuid);
    }

    console.log('sending data to database:', localStorageData, dbStorageData);
    return true;
  } catch (error) {
    console.error('Error in sendDataToDB:', error);
    return false;
  }
}

export {sendDataToDB};
