import * as SecureStore from 'expo-secure-store';
import {removeAllLocalData} from './localStorage';
const keychainService = '38WX44YTA6.com.blitzwallet.SharedKeychain';

const KEYCHAIN_OPTION = {
  keychainService: keychainService,
  keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY,
};

async function storeData(key, value) {
  try {
    await SecureStore.setItemAsync(key, value, KEYCHAIN_OPTION);

    return new Promise(resolve => {
      resolve(true);
    });
  } catch (error) {
    console.log(error, 'SECURE STORE ERROR');
    return new Promise(resolve => {
      resolve(false);
    });
  }
}

async function retrieveData(key) {
  try {
    const [oldPin, oldMnemoinc] = await Promise.all([
      SecureStore.getItemAsync('pin'),
      SecureStore.getItemAsync('mnemonic'),
    ]);

    if (oldPin || oldMnemoinc) {
      oldPin && (await storeData('pin', oldPin));
      oldMnemoinc && (await storeData('mnemonic', oldMnemoinc));
      await SecureStore.deleteItemAsync('pin');
      await SecureStore.deleteItemAsync('mnemonic');
    }
    const value = await SecureStore.getItemAsync(key, KEYCHAIN_OPTION);
    // if (key === 'mnemonic') {
    //   const breezMnemoinc = await SecureStore.getItemAsync(
    //     'BREEZ_SDK_SEED_MNEMONIC',
    //     KEYCHAIN_OPTION,
    //   );
    //   if (!breezMnemoinc) storeData('BREEZ_SDK_SEED_MNEMONIC', value);
    // }
    if (value) {
      return new Promise(resolve => {
        resolve(value);
      });
    } else {
      return new Promise(resolve => {
        resolve(false);
      });
    }
  } catch (error) {
    return new Promise(resolve => {
      resolve(false);
    });
  }
}

async function terminateAccount() {
  try {
    await SecureStore.deleteItemAsync('key', KEYCHAIN_OPTION);
    await SecureStore.deleteItemAsync('pin', KEYCHAIN_OPTION);
    await SecureStore.deleteItemAsync('mnemonic', KEYCHAIN_OPTION);

    const didRemove = await removeAllLocalData();
    if (!didRemove) throw Error('not able to remove local storage data');

    return new Promise(resolve => {
      resolve(true);
    });
  } catch (error) {
    return new Promise(resolve => {
      resolve(false);
    });
  }
}

async function deleteItem(key) {
  try {
    await SecureStore.deleteItemAsync(key, KEYCHAIN_OPTION);

    return new Promise(Response => {
      Response(true);
    });
  } catch (error) {
    return new Promise(Response => {
      Response(false);
    });
  }
}

export {retrieveData, storeData, terminateAccount, deleteItem};
