import {Platform, Share} from 'react-native';
import {crashlyticsLogReport} from './crashlyticsLogs';
import {
  documentDirectory,
  EncodingType,
  StorageAccessFramework,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

export default async function writeAndShareFileToFilesystem(
  fileData,
  fileName,
  fileType,
) {
  console.log('Running in new filesystem write and share...');

  try {
    crashlyticsLogReport('Starting write to filesystem process');

    const fileUri = `${documentDirectory}${fileName}`;
    await writeAsStringAsync(fileUri, fileData, {
      encoding: EncodingType.UTF8,
    });

    if (Platform.OS === 'ios') {
      await Share.share({
        title: `${fileName}`,
        url: `${fileUri}`,
        type: fileType,
      });
      return {success: true, error: null};
    } else {
      try {
        const permissions =
          await StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (permissions.granted) {
          const data = await StorageAccessFramework.readAsStringAsync(fileUri);

          try {
            const uri = await StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              fileName,
              fileType,
            );
            await writeAsStringAsync(uri, data);
            return {success: true, error: null};
          } catch (err) {
            console.log('writting file to filesystem for android err', err);
            return {
              success: false,
              error: 'errormessages.savingFileError',
              originalError: err,
            };
          }
        } else {
          await Share.share({
            title: `${fileName}`,
            url: `${fileUri}`,
            type: fileType,
          });
          return {success: true, error: null};
        }
      } catch (err) {
        console.log('android permission error', err);
        return {
          success: false,
          error: 'errormessages.savingFilePermissionsError',
          originalError: err,
        };
      }
    }
  } catch (e) {
    console.log('saving to filesystem error', e);
    return {
      success: false,
      error: 'errormessages.writtingFileError',
      originalError: e,
    };
  }
}
