import * as FileSystem from 'expo-file-system';
import {Platform, Share} from 'react-native';
import {crashlyticsLogReport} from './crashlyticsLogs';
export default async function writeAndShareFileToFilesystem(
  fileData,
  fileName,
  fileType,
  navigate,
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
    } else {
      try {
        const permissions =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const data =
            await FileSystem.StorageAccessFramework.readAsStringAsync(fileUri);

          await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            fileType,
          )
            .then(async uri => {
              await FileSystem.writeAsStringAsync(uri, data);
            })
            .catch(err => {
              console.log('writting file to filesystem for android err', err);
              navigate.navigate('ErrorScreen', {
                errorMessage: 'Error saving file to document',
              });
            });
        } else {
          await Share.share({
            title: `${fileName}`,
            url: `${fileUri}`,
            type: fileType,
          });
        }
      } catch (err) {
        console.log('android permission error', err);
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Error gettings permissions',
        });
      }
    }
  } catch (e) {
    console.log('saving to filesystem error', e);
    navigate.navigate('ErrorScreen', {
      errorMessage: 'Error writting file to filesystem',
    });
  }
}
