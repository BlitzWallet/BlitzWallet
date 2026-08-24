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
const mockReadDirectoryAsync = jest.fn();
const mockDownloadAsync = jest.fn();
const mockCopyAsync = jest.fn(async () => {});
const mockMakeDirectoryAsync = jest.fn(async () => {});

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  cacheDirectory: 'file:///cache/',
  getInfoAsync: (...a) => mockGetInfoAsync(...a),
  readDirectoryAsync: (...a) => mockReadDirectoryAsync(...a),
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
  useImageCacheEntry,
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
  mockReadDirectoryAsync.mockResolvedValue([]);
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
    mockReadDirectoryAsync.mockResolvedValue(['present.jpg']);

    await mount();

    expect(ctx.cache.present).toBeDefined();
    // Deleted entries have a null localUri and are kept as-is (remember the
    // "no image" state so we don't try to re-download it).
    expect(ctx.cache.deleted).toBeDefined();
    // Stale pointer to a purged file is dropped so nothing loads a dead path.
    expect(ctx.cache.missing).toBeUndefined();
  });

  test('getAllLocalKeys / getMultipleItems errors never reject the mount', async () => {
    // A fired Storage/keys error is swallowed so the provider mounts with an
    // untouched cache rather than crashing the tree.
    mockGetAllLocalKeys.mockRejectedValue(new Error('keys boom'));
    await mount();
    expect(ctx.cache).toEqual({});
  });

  test('a single corrupt (crashed mid-write) entry is skipped without losing healthy entries', async () => {
    // JSON.parse is guarded per entry, so one truncated blob (a crash left it
    // mid-write) is dropped while every healthy sibling still rehydrates.
    mockGetAllLocalKeys.mockResolvedValue([`${PREFIX}/bad`, `${PREFIX}/good`]);
    mockGetMultipleItems.mockResolvedValue([
      [`${PREFIX}/bad`, '{"not json'],
      storedEntry('good'),
    ]);
    mockReadDirectoryAsync.mockResolvedValue(['good.jpg']);
    await mount();

    expect(ctx.cache.bad).toBeUndefined();
    expect(ctx.cache.good).toBeDefined();
  });

  test('ignores entries whose persisted pointer lives at a stale path but keeps null-uri deletes', async () => {
    // A genuinely OS-purged file (no file anywhere on disk) drops the pointer,
    // while a null-localUri delete is preserved.
    mockGetAllLocalKeys.mockResolvedValue([`${PREFIX}/purged`, `${PREFIX}/deleted`]);
    mockGetMultipleItems.mockResolvedValue([
      storedEntry('purged'),
      [
        `${PREFIX}/deleted`,
        JSON.stringify({ uri: null, localUri: null, updated: 'x' }),
      ],
    ]);
    // File totally gone (no surviving copy in any dir lending).
    mockReadDirectoryAsync.mockResolvedValue([]);

    await mount();

    expect(ctx.cache.purged).toBeUndefined();
    expect(ctx.cache.deleted).toBeDefined();
    expect(ctx.cache.deleted.localUri).toBeNull();
  });

  test('keeps + rehydrates entry stored with a stale (pre-update) absolute path', async () => {
    // Simulates an app version update: iOS moved the container so the persisted
    // path points at an old dir, but the file survives at the current dir.
    mockGetAllLocalKeys.mockResolvedValue([`${PREFIX}/moved`]);
    mockGetMultipleItems.mockResolvedValue([
      [
        `${PREFIX}/moved`,
        JSON.stringify({
          uri: 'file:///OLD-CONTAINER/profile_images/moved.jpg',
          localUri: 'file:///OLD-CONTAINER/profile_images/moved.jpg',
          updated: 'updated-moved',
        }),
      ],
    ]);
    // Only the current-dir file survives; the stale stored path would 404.
    mockReadDirectoryAsync.mockResolvedValue(['moved.jpg']);

    await mount();

    expect(ctx.cache.moved).toBeDefined();
    expect(ctx.cache.moved.localUri).toBe(
      'file:///cache/profile_images/moved.jpg',
    );
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

  test('rejects and does not persist when downloadAsync resolves null/undefined', async () => {
    // Simulates a cancelled / failed native download that returns nothing.
    await mount();
    mockDownloadAsync.mockResolvedValue(null);

    let error;
    await act(async () => {
      try {
        await ctx.refreshCache('abc', 'https://example.com/abc.jpg');
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeTruthy();
    expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
    expect(ctx.cache.abc).toBeUndefined();
  });

  test('rejects and does not persist when the post-write file info reports missing', async () => {
    // Crash during the write can leave the pointer "saved" but the file never
    // committed (or the intermediate dir races with the OS purge).
    await mount();
    mockDownloadAsync.mockResolvedValue({ status: 200 });
    mockGetInfoAsync.mockResolvedValue({ exists: false, size: 0 });

    let error;
    await act(async () => {
      try {
        await ctx.refreshCache('mno', 'https://example.com/mno.jpg');
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeTruthy();
    expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
    expect(ctx.cache.mno).toBeUndefined();
  });

  test('rejects and does not persist when makeDirectoryAsync fails', async () => {
    // OS forbids writing (full disk / permissions) — downloadsteps before
    // download even starts, so nothing is persisted.
    await mount();
    mockMakeDirectoryAsync.mockRejectedValue(new Error('disk full'));

    let error;
    await act(async () => {
      try {
        await ctx.refreshCache('jkl', 'https://example.com/jkl.jpg');
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeTruthy();
    expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
    expect(ctx.cache.jkl).toBeUndefined();
  });

  test('uses copyAsync for non-http uris and validates the copied file', async () => {
    // Local-source avatars (contact picker, gallery) don't go through the
    // downloader. A successful copy still must pass the empty-file check.
    await mount();
    mockCopyAsync.mockResolvedValue(undefined);
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1234 });

    const result = await act(async () => {
      return await ctx.refreshCache('cp', 'not/an/http/uri');
    });

    expect(mockDownloadAsync).not.toHaveBeenCalled();
    expect(mockCopyAsync).toHaveBeenCalled();
    expect(result.localUri).toBe('file:///cache/profile_images/cp.jpg');
    expect(mockSetLocalStorageItem).toHaveBeenCalled();
    expect(ctx.cache.cp).toBeDefined();
  });

  test('copy path rejects and does not persist when the copied file is empty', async () => {
    await mount();
    mockCopyAsync.mockResolvedValue(undefined);
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 0 });

    let error;
    await act(async () => {
      try {
        await ctx.refreshCache('cp2', 'not/an/uri');
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeTruthy();
    expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
    expect(ctx.cache.cp2).toBeUndefined();
  });

  test('concurrent refreshes for the same uuid share a single in-flight request', async () => {
    await mount();
    mockDownloadAsync.mockResolvedValue({ status: 200 });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 10 });

    let r1;
    let r2;
    await act(async () => {
      r1 = ctx.refreshCache('dup', 'https://example.com/dup.jpg');
      r2 = ctx.refreshCache('dup', 'https://example.com/dup.jpg');
      await Promise.all([r1, r2]);
    });

    expect(mockDownloadAsync).toHaveBeenCalledTimes(1);
    expect(mockSetLocalStorageItem).toHaveBeenCalledTimes(1);
  });

  test('explicit refresh with skipCacheUpdate persists but does not touch memory cache', async () => {
    await mount();
    mockDownloadAsync.mockResolvedValue({ status: 200 });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 9 });

    await act(async () => {
      await ctx.refreshCache('sk', 'https://example.com/sk.jpg', true);
    });

    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      `${PREFIX}/sk`,
      expect.stringContaining('sk.jpg'),
    );
    expect(ctx.cache.sk).toBeUndefined();
  });
});

describe('removeProfileImageFromCache (delete)', () => {
  test('persists a null entry so the "no image" state is remembered', async () => {
    await mount();
    await act(async () => {
      await ctx.removeProfileImageFromCache('me');
    });

    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      `${PREFIX}/me`,
      expect.stringContaining('"localUri":null'),
    );
    expect(ctx.cache.me).toBeDefined();
    expect(ctx.cache.me.localUri).toBeNull();
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

  test('a Storage getMetadata rejection arms the cooldown (no download needed)', async () => {
    await mount();
    // Storage errors (network, permissions, missing key) fail before download.
    mockGetMetadata.mockRejectedValue(new Error('storage boom'));

    // First automatic attempt fails at the metadata step.
    await act(async () => {
      await ctx.refreshCache('net', null).catch(() => {});
    });
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);

    // Second automatic attempt within the window is skipped — no new storage IO.
    await act(async () => {
      await ctx.refreshCache('net', null).catch(() => {});
    });
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);
    expect(mockGetDownloadURL).not.toHaveBeenCalled();
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

describe('cache reconcile only re-runs when the contact set changes', () => {
  test('metadata-only edits (same uuids) skip the reload; a new uuid triggers it', async () => {
    mockGetAllLocalKeys.mockResolvedValue([]);
    mockGetMultipleItems.mockResolvedValue([]);
    mockReadDirectoryAsync.mockResolvedValue([]);

    let tree;
    mockContacts.decodedAddedContacts = [{ uuid: 'a' }, { uuid: 'b' }];
    await act(async () => {
      tree = ReactTestRenderer.create(providerElement());
    });
    await flush();
    expect(mockGetAllLocalKeys).toHaveBeenCalledTimes(1);

    // Same uuids, new array reference (pin/name/bio edit re-encrypts the list)
    // → no reload of the whole cache.
    mockContacts.decodedAddedContacts = [
      { uuid: 'b', isFavorite: true },
      { uuid: 'a', name: 'renamed' },
    ];
    await act(async () => {
      tree.update(providerElement());
    });
    await flush();
    expect(mockGetAllLocalKeys).toHaveBeenCalledTimes(1);

    // A genuinely new contact uuid → reload.
    mockContacts.decodedAddedContacts = [
      { uuid: 'b', isFavorite: true },
      { uuid: 'a', name: 'renamed' },
      { uuid: 'c' },
    ];
    await act(async () => {
      tree.update(providerElement());
    });
    await flush();
    expect(mockGetAllLocalKeys).toHaveBeenCalledTimes(2);

    // A removed uuid also reloads.
    mockContacts.decodedAddedContacts = [{ uuid: 'c' }];
    await act(async () => {
      tree.update(providerElement());
    });
    await flush();
    expect(mockGetAllLocalKeys).toHaveBeenCalledTimes(3);
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

    // Advance past the 30s pass throttle AND the 24h success TTL, so the
    // foreground re-heal actually re-checks the (now-stale) contact instead of
    // being short-circuited by the freshness window.
    now += 25 * 60 * 60 * 1000;

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

describe('initial pass survives dep churn during its delay', () => {
  test('churn mid-wait does not cancel the pending pass and runs the latest contacts', async () => {
    jest.useFakeTimers();
    // Child-account boot sequence from the bug report: no homepage and no
    // profile uuid yet.
    mockAppStatus.didGetToHomepage = false;
    mockGlobalCtx.masterInfoObject = null;
    mockContacts.decodedAddedContacts = [];
    mockGetMetadata.mockResolvedValue({ updated: 'm1' });
    mockGetDownloadURL.mockResolvedValue('https://example.com/x.jpg');
    mockDownloadAsync.mockResolvedValue({ status: 200 });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 10 });

    let tree;
    await act(async () => {
      tree = ReactTestRenderer.create(providerElement());
    });

    // Profile uuid arrives while still off-homepage.
    mockGlobalCtx.masterInfoObject = { uuid: 'me-uuid' };
    await act(async () => {
      tree.update(providerElement());
    });
    expect(mockGetMetadata).not.toHaveBeenCalled();

    // Homepage settles → initial pass scheduled with a 5s delay.
    mockAppStatus.didGetToHomepage = true;
    await act(async () => {
      tree.update(providerElement());
    });
    expect(mockGetMetadata).not.toHaveBeenCalled();

    // Mid-wait churn (the child-claim handoff adds the parent contact via
    // addContact → new decodedAddedContacts → new runFreshnessPass identity).
    // Previously the effect cleanup cleared the pending timer here and the
    // one-shot guard never rescheduled, so the pass never ran.
    mockContacts.decodedAddedContacts = [
      { uuid: 'parent-uuid', isLNURL: false },
    ];
    await act(async () => {
      tree.update(providerElement());
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await flush();

    // The pass still fired despite the churn — and ran with the LATEST
    // contact list, so the freshly added parent is checked too.
    const refPaths = mockRef.mock.calls.map(c => c[1]);
    expect(refPaths).toContain(`${PREFIX}/me-uuid.jpg`);
    expect(refPaths).toContain(`${PREFIX}/parent-uuid.jpg`);
  });
});

describe('freshness pass avoids JS-thread re-render storms', () => {
  test('still-current refresh persists lastChecked but leaves React cache untouched', async () => {
    // Seed a healthy, current entry (file present, updated matches server).
    mockGetAllLocalKeys.mockResolvedValue([`${PREFIX}/present`]);
    mockGetMultipleItems.mockResolvedValue([storedEntry('present')]);
    mockReadDirectoryAsync.mockResolvedValue(['present.jpg']);
    mockGetMetadata.mockResolvedValue({ updated: 'updated-present' });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 10 });

    await mount();
    const cacheBefore = ctx.cache;

    await act(async () => {
      await ctx.refreshCache('present', null);
    });

    // TTL timestamp is persisted (cross-launch TTL still works)…
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      `${PREFIX}/present`,
      expect.stringContaining('lastChecked'),
    );
    // …but nothing visible changed, so no setState was issued and no consumer
    // re-rendered (with a large contact list, one setCache per contact on every
    // pass was the dominant JS-thread cost of the freshness pass).
    expect(ctx.cache).toBe(cacheBefore);
    expect(ctx.cache.present.updated).toBe('updated-present');
  });

  test('still-current refresh commits when the visible entry actually changed', async () => {
    // A "deleted" entry (null localUri) whose file survives on disk (a crash
    // mid-delete). The metadata still matches, but re-anchoring the pointer is
    // a real visible change, so the refresh MUST update React state.
    mockGetAllLocalKeys.mockResolvedValue([`${PREFIX}/resurrect`]);
    mockGetMultipleItems.mockResolvedValue([
      [
        `${PREFIX}/resurrect`,
        JSON.stringify({ uri: null, localUri: null, updated: 'updated-r' }),
      ],
    ]);
    mockReadDirectoryAsync.mockResolvedValue(['resurrect.jpg']);
    mockGetMetadata.mockResolvedValue({ updated: 'updated-r' });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 10 });

    await mount();
    expect(ctx.cache.resurrect.localUri).toBeNull();
    const cacheBefore = ctx.cache;

    await act(async () => {
      await ctx.refreshCache('resurrect', null);
    });

    expect(ctx.cache).not.toBe(cacheBefore);
    expect(ctx.cache.resurrect.localUri).toBe(
      'file:///cache/profile_images/resurrect.jpg',
    );
  });

  test('useImageCacheEntry consumers re-render only when their own uuid changes', async () => {
    mockDownloadAsync.mockResolvedValue({ status: 200 });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 10 });

    const renderCounts = { a: 0, b: 0 };
    function EntryReader({ uuid }) {
      useImageCacheEntry(uuid);
      renderCounts[uuid] += 1;
      return null;
    }

    let tree;
    await act(async () => {
      tree = ReactTestRenderer.create(
        React.createElement(
          ImageCacheProvider,
          null,
          React.createElement(
            React.Fragment,
            null,
            React.createElement(EntryReader, { uuid: 'a' }),
            React.createElement(EntryReader, { uuid: 'b' }),
            React.createElement(Capture, null),
          ),
        ),
      );
    });
    await flush();

    const aBefore = renderCounts.a;
    const bBefore = renderCounts.b;

    // Only uuid 'a' changes → only its subscriber re-renders.
    await act(async () => {
      await ctx.refreshCache('a', 'https://example.com/a.jpg');
    });
    await flush();

    expect(renderCounts.a).toBeGreaterThan(aBefore);
    expect(renderCounts.b).toBe(bBefore);

    // A second update to the same uuid re-renders it again.
    const aAfterFirst = renderCounts.a;
    await act(async () => {
      await ctx.refreshCache('a', 'https://example.com/a2.jpg');
    });
    await flush();
    expect(renderCounts.a).toBeGreaterThan(aAfterFirst);
    expect(renderCounts.b).toBe(bBefore);
  });
});
