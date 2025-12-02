import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

async function getImageHash(imageUri) {
  if (!imageUri) return '';
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.MD5,
    base64,
  );

  return hash;
}

export async function areImagesSame(uri1, uri2) {
  const hash1 = await getImageHash(uri1);
  const hash2 = await getImageHash(uri2);

  return hash1 === hash2;
}
