import AsyncStorage from '@react-native-async-storage/async-storage';
import {crashlyticsLogReport} from './crashlyticsLogs';

export async function setLocalStorageItem(key, val) {
  try {
    crashlyticsLogReport('Starting setting local storage item function');
    await AsyncStorage.setItem(key, val);
    return new Promise(resolve => {
      resolve(true);
    });
  } catch (error) {
    return new Promise(resolve => {
      resolve(false);
    });
  }
}
export async function getLocalStorageItem(key) {
  try {
    crashlyticsLogReport('Starting get local storage item function');
    const item = await AsyncStorage.getItem(key);

    if (item !== null) {
      const parsedItem = item;
      return new Promise(resolve => {
        resolve(parsedItem);
      });
    }

    return new Promise(resolve => {
      resolve(item);
    });
  } catch (error) {
    return new Promise(resolve => {
      resolve(null);
    });
  }
}
export async function removeLocalStorageItem(key) {
  try {
    crashlyticsLogReport('Starting remove local storage item function');
    await AsyncStorage.removeItem(key);
    return new Promise(resolve => {
      resolve(true);
    });
  } catch (error) {
    return new Promise(resolve => {
      resolve(false);
    });
  }
}

export async function removeAllLocalData() {
  try {
    crashlyticsLogReport('Starting remove all local storage item function');
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys);
    return true;
  } catch (e) {
    console.log(e);
    return false;
    // read key error
  }
}
