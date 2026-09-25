import {Platform, Share} from 'react-native';
import * as Sharing from 'expo-sharing';
import {crashlyticsLogReport} from './crashlyticsLogs';
import {
  documentDirectory,
  EncodingType,
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

    if (Platform.OS === 'web') {
      const blob = new Blob([fileData], {type: `${fileType};charset=utf-8`});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      try {
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        return {success: true, error: null};
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }

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
    }

    // Android: share the file through expo-sharing (FileProvider content://
    // URI). This intentionally avoids StorageAccessFramework
    // .requestDirectoryPermissionsAsync, whose native OnActivityResult handler
    // double-resolves its promise and crashes the app with
    // PromiseAlreadySettledException (uncatchable from JS). The share sheet
    // still lets users "Save to Files"/Downloads.
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: fileType,
        dialogTitle: fileName,
      });
      return {success: true, error: null};
    }

    await Share.share({
      title: `${fileName}`,
      url: `${fileUri}`,
      type: fileType,
    });
    return {success: true, error: null};
  } catch (e) {
    console.log('saving to filesystem error', e);
    return {
      success: false,
      error: 'errormessages.writtingFileError',
      originalError: e,
    };
  }
}
