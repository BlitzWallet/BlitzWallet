import * as FileSystem from 'expo-file-system';
import {Platform, Share} from 'react-native';
import {crashlyticsLogReport} from './crashlyticsLogs';

export default async function writeAndShareFileToFilesystem(
  fileData,
  fileName,
  fileType,
) {
  console.log('Running in new filesystem write and share...');

  try {
    crashlyticsLogReport('Starting write to filesystem process');
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, fileData, {
      encoding: FileSystem.EncodingType.UTF8,
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
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (permissions.granted) {
          const data =
            await FileSystem.StorageAccessFramework.readAsStringAsync(fileUri);

          try {
            const uri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              fileName,
              fileType,
            );
            await FileSystem.writeAsStringAsync(uri, data);
            return {success: true, error: null};
          } catch (err) {
            console.log('writting file to filesystem for android err', err);
            return {
              success: false,
              error: 'Error saving file to document',
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
          error: 'Error getting permissions',
          originalError: err,
        };
      }
    }
  } catch (e) {
    console.log('saving to filesystem error', e);
    return {
      success: false,
      error: 'Error writing file to filesystem',
      originalError: e,
    };
  }
}
