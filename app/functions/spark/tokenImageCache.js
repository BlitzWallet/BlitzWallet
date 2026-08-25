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
// Bounds batch lookups so a huge tokenId list (e.g. from a crafted token
// registry) can never exhaust sockets, memory, or disk: at most this many
// downloads run at once. Every id is still resolved, just in waves.
const CONCURRENCY_LIMIT = 10;
// One in-flight lookup per tokenId, so overlapping callers share a request
// instead of racing to download and write the same cache key twice.
const inFlight = new Map();

export function getCachedTokenImage(tokenId) {
  const existing = inFlight.get(tokenId);
  if (existing) return existing;

  const lookup = loadTokenImage(tokenId).finally(() =>
    inFlight.delete(tokenId),
  );
  inFlight.set(tokenId, lookup);
  return lookup;
}

async function loadTokenImage(tokenId) {
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
  const entries = [];
  for (let i = 0; i < tokenIds.length; i += CONCURRENCY_LIMIT) {
    const batch = tokenIds.slice(i, i + CONCURRENCY_LIMIT);
    const resolved = await Promise.all(
      batch.map(async tokenId => [tokenId, await getCachedTokenImage(tokenId)]),
    );
    entries.push(...resolved);
  }
  return Object.fromEntries(entries);
}
