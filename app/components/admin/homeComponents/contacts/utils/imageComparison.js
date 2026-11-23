import { createHash } from 'react-native-quick-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

async function getImageHash(imageUri) {
  if (!imageUri) return '';
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const hash = createHash('md5').update(base64).digest('hex');

  return hash;
}

export async function areImagesSame(uri1, uri2) {
  if (Platform.OS === 'web') return false;

  const hash1 = await getImageHash(uri1);
  const hash2 = await getImageHash(uri2);

  return hash1 === hash2;
}
