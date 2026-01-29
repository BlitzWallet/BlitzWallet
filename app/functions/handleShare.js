import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';
import {
  documentDirectory,
  EncodingType,
  StorageAccessFramework,
  writeAsStringAsync,
  readAsStringAsync,
} from 'expo-file-system/legacy';
import writeAndShareFileToFilesystem from './writeFileToFilesystem';

/**
 * Normalize file URI to ensure it starts with file://
 */
const normalizeFileUri = uri =>
  uri.startsWith('file://') ? uri : `file://${uri}`;

/**
 * Determine encoding type based on file type
 */
const getEncodingForFileType = fileType => {
  const binaryTypes = [
    'application/pdf',
    'application/zip',
    'application/octet-stream',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
  ];
  return binaryTypes.includes(fileType)
    ? EncodingType.Base64
    : EncodingType.UTF8;
};

/**
 * Share a file using expo-sharing
 *
 * @param {string} url - The local file URL to share (required)
 * @param {Object} options - Sharing options
 * @param {string} options.mimeType - The MIME type of the file
 * @param {string} options.dialogTitle - Title for the share dialog (Android only)
 * @param {string} options.UTI - Uniform Type Identifier for the file (iOS only)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function shareFile(url, options = {}) {
  try {
    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    if (!url) {
      throw new Error('File URL is required');
    }

    const sharingOptions = {};

    if (options.mimeType) sharingOptions.mimeType = options.mimeType;
    if (options.dialogTitle) sharingOptions.dialogTitle = options.dialogTitle;
    if (options.UTI) sharingOptions.UTI = options.UTI;

    await Sharing.shareAsync(url, sharingOptions);

    return { success: true, error: null };
  } catch (error) {
    console.error('File sharing failed:', error);
    return { success: false, error: error.message, originalError: error };
  }
}

/**
 * Share text/message using React Native's Share API
 *
 * @param {Object} content - Content to share
 * @param {string} content.message - The message to share
 * @param {string} content.url - URL to share
 * @param {string} content.title - Title for the share dialog
 * @param {string} content.type - MIME type (Android only)
 * @param {Object} options - Additional options
 * @param {string} options.dialogTitle - Title for share dialog (Android only)
 * @param {string} options.subject - Subject when sharing via email (iOS only)
 * @param {string[]} options.excludedActivityTypes - Activity types to exclude (iOS only)
 * @param {string} options.tintColor - Tint color for share sheet (iOS only)
 * @returns {Promise<{success: boolean, action?: string, activityType?: string, error?: string}>}
 */
export async function shareMessage(content, options = {}) {
  try {
    if (!content.message && !content.url) {
      throw new Error('Either message or url is required');
    }

    const shareContent = {};

    if (content.message) shareContent.message = content.message;
    if (content.url) shareContent.url = content.url;
    if (content.title) shareContent.title = content.title;
    if (content.type) shareContent.type = content.type;

    const shareOptions = {};

    if (options.dialogTitle) shareOptions.dialogTitle = options.dialogTitle;
    if (options.subject) shareOptions.subject = options.subject;
    if (options.excludedActivityTypes)
      shareOptions.excludedActivityTypes = options.excludedActivityTypes;
    if (options.tintColor) shareOptions.tintColor = options.tintColor;

    const result = await Share.share(shareContent, shareOptions);

    return {
      success: true,
      action: result.action,
      activityType: result.activityType,
      error: null,
    };
  } catch (error) {
    console.error('Message sharing failed:', error);
    return { success: false, error: error.message, originalError: error };
  }
}

/**
 * Write file to app's document directory
 *
 * @param {string} fileData - The file content (Base64 for binary, UTF8 for text)
 * @param {string} fileName - Name of the file
 * @param {string} fileType - MIME type of the file
 * @returns {Promise<{success: boolean, fileUri?: string, error?: string}>}
 */
export async function writeFileToDocumentDirectory(
  fileData,
  fileName,
  fileType,
) {
  try {
    const encoding = getEncodingForFileType(fileType);
    const fileUri = `${documentDirectory}${fileName}`;

    await writeAsStringAsync(fileUri, fileData, { encoding });

    return { success: true, fileUri, error: null };
  } catch (error) {
    console.error('Write to document directory failed:', error);
    return {
      success: false,
      error: 'errormessages.writtingFileError',
      originalError: error,
    };
  }
}

/**
 * Write file using Android's Storage Access Framework
 *
 * @param {string} fileData - The file content
 * @param {string} fileName - Name of the file
 * @param {string} fileType - MIME type of the file
 * @param {string} sourceFileUri - Source file URI to copy from (optional)
 * @returns {Promise<{success: boolean, destUri?: string, error?: string}>}
 */
export async function writeFileUsingSAF(
  fileData,
  fileName,
  fileType,
  sourceFileUri = null,
) {
  try {
    // Request directory permissions
    const permissions =
      await StorageAccessFramework.requestDirectoryPermissionsAsync();

    if (!permissions.granted) {
      return {
        success: false,
        error: 'Storage permission denied',
        permissionDenied: true,
      };
    }

    // Create destination file
    const destUri = await StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      fileName,
      fileType,
    );

    // Determine encoding
    const encoding = getEncodingForFileType(fileType);

    // If source file URI provided, read from it first
    let dataToWrite = fileData;
    if (sourceFileUri) {
      dataToWrite = await readAsStringAsync(normalizeFileUri(sourceFileUri), {
        encoding,
      });
    }

    // Write to SAF destination
    await writeAsStringAsync(destUri, dataToWrite, { encoding });

    return { success: true, destUri, error: null };
  } catch (error) {
    console.error('SAF write failed:', error);
    return {
      success: false,
      error: 'errormessages.savingFileError',
      originalError: error,
    };
  }
}

/**
 * Universal share function that automatically determines the best sharing method
 *
 * @param {Object} content - Content to share
 * @param {string} content.message - Text message to share
 * @param {string} content.url - URL to share (can be file:// for files or https:// for links)
 * @param {string} content.title - Title for the share dialog
 * @param {string} content.type - MIME type
 * @param {string} content.fileData - File data for write-and-share
 * @param {string} content.fileName - File name for write-and-share
 * @param {Object} options - Additional options
 * @returns {Promise<Object>}
 */
export async function share(content, options = {}) {
  try {
    // If fileData and fileName are provided, use write-and-share
    if (content.fileData && content.fileName) {
      return await writeAndShareFileToFilesystem(
        content.fileData,
        content.fileName,
        content.type || 'text/plain',
        options,
      );
    }

    // If it's a local file URL, use expo-sharing
    const isFileShare = content.url && content.url.startsWith('file://');

    if (isFileShare) {
      return await shareFile(content.url, {
        mimeType: content.type,
        dialogTitle: content.title,
        ...options,
      });
    }

    // Otherwise use message sharing
    return await shareMessage(content, options);
  } catch (error) {
    console.error('Sharing failed:', error);
    return { success: false, error: error.message, originalError: error };
  }
}

/**
 * Check if file sharing is available on the current device
 */
export async function isFileSharingAvailable() {
  try {
    return await Sharing.isAvailableAsync();
  } catch (error) {
    console.error('Error checking file sharing availability:', error);
    return false;
  }
}
