import {getLocalStorageItem, setLocalStorageItem} from './localStorage';
import {Platform} from 'react-native';
import customUUID from './customUUID';
import {getInfoAsync, makeDirectoryAsync} from 'expo-file-system';

export async function getOrCreateDirectory(uuidKey, workingDir) {
  try {
    let savedUUID = await getLocalStorageItem(uuidKey);
    if (!savedUUID) {
      savedUUID = customUUID();
      await setLocalStorageItem(uuidKey, savedUUID);
    }

    const directoryPath = `${workingDir}/${savedUUID}`;
    // On Android, we need the file:// prefix for the getInfoAsync check
    const checkPath =
      Platform.OS === 'android' ? `file://${directoryPath}` : directoryPath;

    const dirInfo = await getInfoAsync(checkPath);
    console.log('Directory Info:', dirInfo);

    if (!dirInfo.exists) {
      await makeDirectoryAsync(checkPath, {intermediates: true});
      console.log(`Directory created: ${checkPath}`);
      await new Promise(resolve => setTimeout(resolve, 8000)); //adds buffer
    } else {
      console.log(`Directory already exists: ${checkPath}`);
    }

    return directoryPath;
  } catch (err) {
    console.error('Error ensuring directory:', err);
    throw err;
  }
}

export function unit8ArrayConverter(unitArray) {
  return Array.from(
    unitArray.filter(num => Number.isInteger(num) && num >= 0 && num <= 255),
  );
}
