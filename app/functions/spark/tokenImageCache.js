import {
  cacheDirectory,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';

const FILE_DIR = cacheDirectory + 'tokenImages/';
const CACHE_KEY = tokenId => `BLITZ_TOKEN_IMG/${tokenId}`;
const EXTENSIONS = ['jpg', 'png'];
// How long to trust a "no image exists" result before re-checking the network.
const NEGATIVE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function getCachedTokenImage(tokenId) {
  try {
    const key = CACHE_KEY(tokenId);

    const cacheEntry = await getLocalStorageItem(key);
    const parsed = cacheEntry ? JSON.parse(cacheEntry) : null;

    if (parsed?.exists === true && parsed.localUri) {
      const info = await getInfoAsync(parsed.localUri);
      console.log(info, 'image info');
      if (info.exists) return parsed.localUri;
    }

    if (
      parsed?.exists === false &&
      Date.now() - parsed.checkedAt < NEGATIVE_TTL
    ) {
      return null;
    }

    for (const ext of EXTENSIONS) {
      const url = `https://tokens.sparkscan.io/${tokenId}.${ext}`;
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) continue;

        await makeDirectoryAsync(FILE_DIR, { intermediates: true });
        const localUri = `${FILE_DIR}${tokenId}.${ext}`;
        await downloadAsync(url, localUri);

        await setLocalStorageItem(
          key,
          JSON.stringify({ localUri, exists: true, checkedAt: Date.now() }),
        );
        return localUri;
      } catch (err) {
        console.log('Token image fetch error:', tokenId, err);
      }
    }

    await setLocalStorageItem(
      key,
      JSON.stringify({ exists: false, checkedAt: Date.now() }),
    );
    return null;
  } catch (e) {
    console.log('Error caching token image', e);
    return null;
  }
}

export async function getCachedTokenImages(tokenIds) {
  const entries = await Promise.all(
    tokenIds.map(async tokenId => [
      tokenId,
      await getCachedTokenImage(tokenId),
    ]),
  );
  return Object.fromEntries(entries);
}
