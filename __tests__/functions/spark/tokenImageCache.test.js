// getCachedTokenImages fans a tokenId list out into network + disk work
// (one HEAD request and up to one download per id). These tests pin the
// resource bounds: work is processed in small batches so in-flight downloads
// stay bounded, every id is still resolved, concurrent callers share one
// lookup per id, and the result maps found ids to their local uri and misses
// to null.
jest.mock('../../../app/functions/localStorage', () => {
  const store = {};
  return {
    getLocalStorageItem: jest.fn(async key =>
      key in store ? store[key] : null,
    ),
    setLocalStorageItem: jest.fn(async (key, val) => {
      store[key] = val;
    }),
    __reset: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  };
});

jest.mock('expo-file-system/legacy', () => {
  let inFlight = 0;
  let maxInFlight = 0;
  let downloads = 0;
  return {
    cacheDirectory: '/mockCacheDir/',
    makeDirectoryAsync: jest.fn(async () => {}),
    getInfoAsync: jest.fn(async () => ({ exists: false })),
    downloadAsync: jest.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      // Yield a macrotask so genuinely concurrent calls overlap.
      await new Promise(resolve => setTimeout(resolve, 0));
      inFlight -= 1;
      downloads += 1;
      return { uri: 'downloaded' };
    }),
    __metrics: {
      reset: () => {
        inFlight = 0;
        maxInFlight = 0;
        downloads = 0;
      },
      stats: () => ({ maxInFlight, downloads }),
    },
  };
});

const localStorage = require('../../../app/functions/localStorage');
const fs = require('expo-file-system/legacy');
const {
  getCachedTokenImages,
} = require('../../../app/functions/spark/tokenImageCache');

describe('getCachedTokenImages', () => {
  beforeEach(() => {
    localStorage.__reset();
    fs.__metrics.reset();
    global.fetch = jest.fn(async url => ({
      ok: !url.toLowerCase().includes('missing'),
    }));
  });

  it('bounds concurrent downloads without dropping any id', async () => {
    const tokenIds = Array.from({ length: 500 }, (_, i) => `tkn${i}`);

    const result = await getCachedTokenImages(tokenIds);
    const { maxInFlight } = fs.__metrics.stats();

    expect(maxInFlight).toBeLessThanOrEqual(10);
    // Truncating the list would starve the tail forever: the caller's effect
    // only re-runs when the token count changes, so a dropped id is never
    // retried and the token silently renders without its image.
    expect(Object.keys(result)).toHaveLength(500);
    expect(result.tkn499).toBe('/mockCacheDir/tokenImages/tkn499.jpg');
  });

  it('shares one in-flight lookup between concurrent callers', async () => {
    // Two overlapping calls (the caller's effect can re-fire before the first
    // finishes) must not download the same id twice or race to write its key.
    const [a, b] = await Promise.all([
      getCachedTokenImages(['btknOK']),
      getCachedTokenImages(['btknOK']),
    ]);
    const { downloads } = fs.__metrics.stats();

    expect(downloads).toBe(1);
    expect(a.btknOK).toBe('/mockCacheDir/tokenImages/btknOK.jpg');
    expect(b.btknOK).toBe(a.btknOK);
  });

  it('maps found images to local uris and misses to null', async () => {
    const result = await getCachedTokenImages(['btknOK', 'btknMissing']);

    expect(result.btknOK).toBe('/mockCacheDir/tokenImages/btknOK.jpg');
    expect(result.btknMissing).toBeNull();
  });

  it('returns an empty map for an empty id list', async () => {
    expect(await getCachedTokenImages([])).toEqual({});
  });
});
