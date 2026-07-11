import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

// ---------------------------------------------------------------------------
// imageCache is a context provider whose interesting logic lives in refs and
// useCallbacks (not visible to renders). We exercise it by rendering the
// provider, capturing the context value via a consumer, and driving
// refreshCache / mount-time reconciliation directly — asserting on the mocked
// filesystem / firebase / storage side effects.
//
// The behaviours under test (all recently added):
//   1. Reconcile-on-load: mount drops pointers whose file is missing, keeps
//      present files and intentionally-deleted (null-uri) entries.
//   2. Hardened write path: a non-200 download or an empty written file rejects
//      and never persists a pointer; a good write persists + updates cache.
//   3. Auto-heal cooldown: an automatic (hasDownloadURL falsy) refresh that
//      FAILS is not retried within the window, a successful one clears it, and
//      explicit user-driven refreshes are never throttled.
//   4. Freshness pass runs without any Spark identity (decoupled from wallet).
// ---------------------------------------------------------------------------

const mockGetMetadata = jest.fn();
const mockGetDownloadURL = jest.fn();
const mockRef = jest.fn((_storage, path) => ({ path }));

jest.mock('@react-native-firebase/storage', () => ({
  __esModule: true,
  getMetadata: (...a) => mockGetMetadata(...a),
  getDownloadURL: (...a) => mockGetDownloadURL(...a),
  ref: (...a) => mockRef(...a),
}));

const mockGetInfoAsync = jest.fn();
const mockDownloadAsync = jest.fn();
const mockCopyAsync = jest.fn(async () => {});
const mockMakeDirectoryAsync = jest.fn(async () => {});

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  cacheDirectory: 'file:///cache/',
  getInfoAsync: (...a) => mockGetInfoAsync(...a),
  downloadAsync: (...a) => mockDownloadAsync(...a),
  copyAsync: (...a) => mockCopyAsync(...a),
  makeDirectoryAsync: (...a) => mockMakeDirectoryAsync(...a),
}));

const mockSetLocalStorageItem = jest.fn(async () => {});
jest.mock('../../app/functions', () => ({
  __esModule: true,
  getLocalStorageItem: jest.fn(async () => null),
  setLocalStorageItem: (...a) => mockSetLocalStorageItem(...a),
}));

const mockGetAllLocalKeys = jest.fn(async () => []);
const mockGetMultipleItems = jest.fn(async () => []);
jest.mock('../../app/functions/localStorage', () => ({
  __esModule: true,
  getAllLocalKeys: (...a) => mockGetAllLocalKeys(...a),
  getMultipleItems: (...a) => mockGetMultipleItems(...a),
}));

jest.mock('../../app/constants', () => ({
  __esModule: true,
  BLITZ_PROFILE_IMG_STORAGE_REF: 'blitzProfileImg',
  VALID_URL_REGEX: /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/,
}));

jest.mock('../../db/initializeFirebase', () => ({ __esModule: true, storage: {} }));

// Consumer contexts — controllable per test.
const mockContacts = { decodedAddedContacts: [] };
jest.mock('../../context-store/globalContacts', () => ({
  __esModule: true,
  useGlobalContactsInfo: () => ({
    decodedAddedContacts: mockContacts.decodedAddedContacts,
  }),
}));

const mockAppStatus = { didGetToHomepage: false, appState: 'active' };
jest.mock('../../context-store/appStatus', () => ({
  __esModule: true,
  useAppStatus: () => ({
    didGetToHomepage: mockAppStatus.didGetToHomepage,
    appState: mockAppStatus.appState,
  }),
}));

const mockGlobalCtx = { masterInfoObject: { uuid: 'me-uuid' } };
jest.mock('../../context-store/context', () => ({
  __esModule: true,
  useGlobalContextProvider: () => ({
    masterInfoObject: mockGlobalCtx.masterInfoObject,
  }),
}));

const {
  ImageCacheProvider,
  useImageCache,
} = require('../../context-store/imageCache');

const PREFIX = 'blitzProfileImg';

let ctx;
function Capture() {
  ctx = useImageCache();
  return null;
}

async function flush() {
  // Drain the microtask queue so async effect / refreshCache chains settle.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount() {
  await act(async () => {
    ReactTestRenderer.create(
      React.createElement(ImageCacheProvider, null, React.createElement(Capture)),
    );
  });
  await flush();
}

function storedEntry(uuid) {
  return [
    `${PREFIX}/${uuid}`,
    JSON.stringify({
      uri: `file:///cache/profile_images/${uuid}.jpg`,
      localUri: `file:///cache/profile_images/${uuid}.jpg`,
      updated: `updated-${uuid}`,
    }),
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockContacts.decodedAddedContacts = [];
  mockAppStatus.didGetToHomepage = false;
  mockAppStatus.appState = 'active';
  mockGlobalCtx.masterInfoObject = { uuid: 'me-uuid' };
  mockGetAllLocalKeys.mockResolvedValue([]);
  mockGetMultipleItems.mockResolvedValue([]);
  mockMakeDirectoryAsync.mockResolvedValue(undefined);
  mockCopyAsync.mockResolvedValue(undefined);
  mockSetLocalStorageItem.mockResolvedValue(undefined);
  ctx = undefined;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function providerElement() {
  return React.createElement(
    ImageCacheProvider,
    null,
    React.createElement(Capture),
  );
}

describe('reconcile pointers on load', () => {
  test('drops entries whose file is missing, keeps present + deleted entries', async () => {
    mockGetAllLocalKeys.mockResolvedValue([
      `${PREFIX}/present`,
      `${PREFIX}/missing`,
      `${PREFIX}/deleted`,
    ]);
    mockGetMultipleItems.mockResolvedValue([
      storedEntry('present'),
      storedEntry('missing'),
      [
        `${PREFIX}/deleted`,
        JSON.stringify({ uri: null, localUri: null, updated: 'x' }),
      ],
    ]);
    mockGetInfoAsync.mockImplementation(async path => ({
      exists: path.includes('present'),
    }));

    await mount();

    expect(ctx.cache.present).toBeDefined();
    // Deleted entries have a null localUri and are kept as-is (remember the
    // "no image" state so we don't try to re-download it).
    expect(ctx.cache.deleted).toBeDefined();
    // Stale pointer to a purged file is dropped so nothing loads a dead path.
    expect(ctx.cache.missing).toBeUndefined();
  });
});

describe('hardened write path', () => {
  test('rejects and does not persist when download status is not 200', async () => {
    await mount();
    mockDownloadAsync.mockResolvedValue({ status: 500 });

    let error;
    await act(async () => {
      try {
        await ctx.refreshCache('xyz', 'https://example.com/xyz.jpg');
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeTruthy();
    expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
    expect(ctx.cache.xyz).toBeUndefined();
  });

  test('rejects and does not persist when the written file is empty', async () => {
    await mount();
    mockDownloadAsync.mockResolvedValue({ status: 200 });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 0 });

    let error;
    await act(async () => {
      try {
        await ctx.refreshCache('xyz', 'https://example.com/xyz.jpg');
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeTruthy();
    expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
    expect(ctx.cache.xyz).toBeUndefined();
  });

  test('persists a pointer and updates cache on a good write', async () => {
    await mount();
    mockDownloadAsync.mockResolvedValue({ status: 200 });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 4321 });

    let result;
    await act(async () => {
      result = await ctx.refreshCache('xyz', 'https://example.com/xyz.jpg');
    });
    await flush();

    expect(result.localUri).toBe('file:///cache/profile_images/xyz.jpg');
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      `${PREFIX}/xyz`,
      expect.stringContaining('xyz.jpg'),
    );
    expect(ctx.cache.xyz).toBeDefined();
  });
});

describe('auto-heal cooldown', () => {
  test('a failed auto refresh is not retried within the window', async () => {
    await mount();
    mockGetMetadata.mockResolvedValue({ updated: 'm1' });
    mockGetDownloadURL.mockResolvedValue('https://example.com/zzz.jpg');
    mockDownloadAsync.mockResolvedValue({ status: 500 }); // fails → arms cooldown

    // First automatic attempt fails.
    await act(async () => {
      await ctx.refreshCache('zzz', null).catch(() => {});
    });
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);
    expect(mockDownloadAsync).toHaveBeenCalledTimes(1);

    // Second automatic attempt is skipped by the cooldown — no new network work.
    await act(async () => {
      await ctx.refreshCache('zzz', null).catch(() => {});
    });
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);
    expect(mockDownloadAsync).toHaveBeenCalledTimes(1);
  });

  test('explicit (user-driven) refresh is never throttled by the cooldown', async () => {
    await mount();
    mockGetMetadata.mockResolvedValue({ updated: 'm1' });
    mockGetDownloadURL.mockResolvedValue('https://example.com/zzz.jpg');
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 10 });
    // auto attempt fails, explicit attempt succeeds.
    mockDownloadAsync
      .mockResolvedValueOnce({ status: 500 })
      .mockResolvedValue({ status: 200 });

    await act(async () => {
      await ctx.refreshCache('zzz', null).catch(() => {});
    });
    expect(mockDownloadAsync).toHaveBeenCalledTimes(1);

    // Explicit call with a download URL bypasses the cooldown and runs.
    await act(async () => {
      await ctx.refreshCache('zzz', 'https://example.com/zzz.jpg');
    });
    await flush();
    expect(mockDownloadAsync).toHaveBeenCalledTimes(2);
    expect(mockSetLocalStorageItem).toHaveBeenCalled();
  });

  test('a successful auto refresh clears the cooldown for the next attempt', async () => {
    await mount();
    mockGetMetadata.mockResolvedValue({ updated: 'm1' });
    mockGetDownloadURL.mockResolvedValue('https://example.com/zzz.jpg');
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 10 });
    mockDownloadAsync
      .mockResolvedValueOnce({ status: 500 }) // auto #1 fails → arms
      .mockResolvedValue({ status: 200 }); // explicit + auto #2 succeed

    await act(async () => {
      await ctx.refreshCache('zzz', null).catch(() => {});
    });
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);

    // Explicit success clears the cooldown.
    await act(async () => {
      await ctx.refreshCache('zzz', 'https://example.com/zzz.jpg');
    });
    await flush();

    // Next auto attempt is allowed again (cooldown cleared) → hits metadata.
    await act(async () => {
      await ctx.refreshCache('zzz', null).catch(() => {});
    });
    expect(mockGetMetadata).toHaveBeenCalledTimes(2);
  });
});

describe('freshness pass is decoupled from Spark', () => {
  test('does not run before homepage; runs 5s after, with no Spark identity', async () => {
    jest.useFakeTimers();
    mockAppStatus.didGetToHomepage = false;
    mockAppStatus.appState = 'active';
    mockGlobalCtx.masterInfoObject = { uuid: 'me-uuid' };
    mockContacts.decodedAddedContacts = [{ uuid: 'c1', isLNURL: false }];
    mockGetMetadata.mockResolvedValue({ updated: 'm1' });
    mockGetDownloadURL.mockResolvedValue('https://example.com/x.jpg');
    mockDownloadAsync.mockResolvedValue({ status: 200 });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 10 });

    let tree;
    await act(async () => {
      tree = ReactTestRenderer.create(providerElement());
    });
    // Before homepage → nothing scheduled.
    expect(mockGetMetadata).not.toHaveBeenCalled();

    // Reaching the homepage schedules the delayed pass but doesn't run it yet.
    mockAppStatus.didGetToHomepage = true;
    await act(async () => {
      tree.update(providerElement());
    });
    expect(mockGetMetadata).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // The pass ran for both the contact and own profile — with no Spark context
    // mocked at all, proving it no longer gates on identityPubKey.
    expect(mockGetMetadata).toHaveBeenCalledTimes(2);
    const refPaths = mockRef.mock.calls.map(c => c[1]);
    expect(refPaths).toContain(`${PREFIX}/c1.jpg`);
    expect(refPaths).toContain(`${PREFIX}/me-uuid.jpg`);
  });

  test('re-runs when appState returns to active (foreground re-heal)', async () => {
    jest.useFakeTimers();
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    mockAppStatus.didGetToHomepage = true;
    mockAppStatus.appState = 'active';
    mockGlobalCtx.masterInfoObject = { uuid: 'me-uuid' };
    mockContacts.decodedAddedContacts = [];
    mockGetMetadata.mockResolvedValue({ updated: 'm1' });
    mockGetDownloadURL.mockResolvedValue('https://example.com/x.jpg');
    mockDownloadAsync.mockResolvedValue({ status: 200 });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 10 });

    let tree;
    await act(async () => {
      tree = ReactTestRenderer.create(providerElement());
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);

    // Advance past the 30s pass throttle.
    now += 31000;

    // Background → foreground: appState transitions back to active.
    mockAppStatus.appState = 'background';
    await act(async () => {
      tree.update(providerElement());
    });
    mockAppStatus.appState = 'active';
    await act(async () => {
      tree.update(providerElement());
      await Promise.resolve();
      await Promise.resolve();
    });

    // The pass ran again on foreground — driven by appStatus's appState, with no
    // second AppState listener of our own.
    expect(mockGetMetadata).toHaveBeenCalledTimes(2);
  });
});
