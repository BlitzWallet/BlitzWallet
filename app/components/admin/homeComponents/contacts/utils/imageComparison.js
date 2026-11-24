import { createHash } from 'react-native-quick-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

async function getImageHash(imageUri) {
  if (!imageUri) return '';
  const data =
    Platform.OS === 'web'
      ? new Uint8Array(await (await fetch(imageUri)).arrayBuffer())
      : await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

  return createHash('sha256').update(data).digest('hex');
}

export async function areImagesSame(uri1, uri2) {
  const hash1 = await getImageHash(uri1);
  const hash2 = await getImageHash(uri2);

  return hash1 === hash2;
}
