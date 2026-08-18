/* eslint-env jest */
// Exercises the REAL db layer for the two data-integrity fixes:
// 1. updateChildAccountRegistryEntry — childAccounts edits run against the
//    LIVE server array inside a transaction, so a stale snapshot can never
//    clobber sibling registry entries (create uses arrayUnion; edits get the
//    same guarantee here).
// 2. getDataFromCollection — falls back to the doc id when a blitzWalletUsers
//    doc is missing its uuid fields, so a sender stripping its own uuid can
//    never land recipients with an unpayable uuid:undefined contact.

jest.mock('../../app/functions/crashlyticsLogs', () => ({
  __esModule: true,
  crashlyticsLogReport: jest.fn(),
  crashlyticsRecordErrorReport: jest.fn(),
}));

// db/index.js pulls a heavy import graph (SQLite, the app/functions barrel, the
// messaging chain). Stub the leaves these helpers never touch so the module
// loads under jest (same pattern as pairingSessions.test.js).
jest.mock('../../app/functions/messaging/cachedMessages', () => ({
  __esModule: true,
  getCachedMessages: jest.fn(),
  queueSetCashedMessages: jest.fn(),
}));
jest.mock('../../app/functions', () => ({
  __esModule: true,
  getLocalStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn(),
}));
jest.mock('../../app/functions/messaging/encodingAndDecodingMessages', () => ({
  __esModule: true,
  decryptMessage: jest.fn(),
  encriptMessage: jest.fn(),
}));
jest.mock('../../app/functions/accounts/childAccounts', () => ({
  __esModule: true,
  getNextChildDerivationIndex: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => {
  const store = new Map();
  const snapFor = key => ({
    exists: () => store.has(key),
    data: () => store.get(key),
    id: key.split('/').pop(),
  });
  const keyOf = ref => ref._key;
  return {
    __esModule: true,
    __store: store,
    getFirestore: () => ({}),
    doc: (_db, col, id, ...sub) => ({
      _key: [col, id, ...sub].join('/'),
    }),
    collection: (_db, col) => ({ _col: col }),
    query: (...args) => ({ _q: args }),
    where: (field, op, val) => ({ field, op, val }),
    getDoc: async ref => snapFor(keyOf(ref)),
    getDocs: async () => ({ empty: true, docs: [] }),
    setDoc: async (ref, data) => {
      store.set(keyOf(ref), data);
    },
    updateDoc: async (ref, data) => {
      const key = keyOf(ref);
      if (!store.has(key)) throw new Error('NOT_FOUND');
      store.set(key, { ...store.get(key), ...data });
    },
    deleteDoc: async ref => {
      store.delete(keyOf(ref));
    },
    writeBatch: () => {
      const ops = [];
      return {
        set: (ref, data) => ops.push([ref, data]),
        commit: async () => {
          for (const [ref, data] of ops) store.set(keyOf(ref), data);
        },
      };
    },
    runTransaction: async (_db, fn) => {
      const tx = {
        get: async ref => {
          const data = store.get(keyOf(ref));
          return { exists: () => data !== undefined, data: () => data };
        },
        set: (ref, data, options) => {
          const key = keyOf(ref);
          if (options && options.merge) {
            store.set(key, { ...(store.get(key) || {}), ...data });
          } else {
            store.set(key, data);
          }
        },
        delete: ref => {
          store.delete(keyOf(ref));
        },
      };
      return fn(tx);
    },
    serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
    Timestamp: {
      fromMillis: ms => ({
        seconds: Math.floor(ms / 1000),
        nanoseconds: 0,
        toMillis: () => ms,
      }),
    },
    onSnapshot: jest.fn(),
    limit: jest.fn(),
    or: jest.fn(),
    orderBy: jest.fn(),
    addDoc: jest.fn(),
    increment: jest.fn(),
  };
});

const {
  updateChildAccountRegistryEntry,
  getDataFromCollection,
} = require('../../db');
const { __store } = require('@react-native-firebase/firestore');

const PARENT = 'parent-pub';
const parentKey = `blitzWalletUsers/${PARENT}`;

const c1 = { uuid: 'uuid-child-1', name: 'Old', childIndex: 2, spendingLimit: null };
const c2 = { uuid: 'uuid-child-2', name: 'Kid2', childIndex: 3, spendingLimit: null };

beforeEach(() => {
  __store.clear();
});

describe('updateChildAccountRegistryEntry (Finding 4 — atomic registry edits)', () => {
  test('edits are computed from the LIVE server array, so a stale snapshot cannot wipe sibling entries', async () => {
    // Server state: c1 + c2. A stale device snapshot would hold only [c1] and,
    // with the old wholesale merge, its rename would erase c2 from the server.
    __store.set(parentKey, { childAccounts: [c1, c2] });

    const ok = await updateChildAccountRegistryEntry(PARENT, entries =>
      entries.map(item =>
        item.uuid === c1.uuid ? { ...item, name: 'Renamed' } : item,
      ),
    );

    expect(ok).toBe(true);
    expect(__store.get(parentKey).childAccounts).toEqual([
      { ...c1, name: 'Renamed' },
      c2,
    ]);
  });

  test('renaming a child that only exists server-side still lands (updater sees live entries)', async () => {
    // The local snapshot never contained c2; the edit must still be applied to
    // c1 without touching c2.
    __store.set(parentKey, { childAccounts: [c1, c2] });

    await updateChildAccountRegistryEntry(PARENT, entries =>
      entries.map(item =>
        item.uuid === c1.uuid ? { ...item, name: 'Renamed' } : item,
      ),
    );

    const saved = __store.get(parentKey).childAccounts;
    expect(saved).toHaveLength(2);
    expect(saved.find(e => e.uuid === c1.uuid).name).toBe('Renamed');
    expect(saved.find(e => e.uuid === c2.uuid)).toEqual(c2);
  });

  test('a missing childAccounts field is treated as an empty registry', async () => {
    __store.set(parentKey, { someOtherField: true });

    const ok = await updateChildAccountRegistryEntry(PARENT, entries => [
      ...entries,
      c1,
    ]);

    expect(ok).toBe(true);
    expect(__store.get(parentKey).childAccounts).toEqual([c1]);
    expect(__store.get(parentKey).someOtherField).toBe(true);
  });

  test('a missing parent uid is rejected (returns false, never throws)', async () => {
    expect(await updateChildAccountRegistryEntry(null, entries => entries)).toBe(
      false,
    );
  });
});

describe('getDataFromCollection (Finding 5 — uuid fallback to doc id)', () => {
  const ATTACKER_DOC_ID = 'attacker-pub';

  test('injects the doc id when top-level and nested myProfile uuids were stripped', async () => {
    __store.set(`blitzWalletUsers/${ATTACKER_DOC_ID}`, {
      contacts: {
        myProfile: {
          name: 'Sneaky',
          uniqueName: 'sneaky',
        },
      },
    });

    const data = await getDataFromCollection(
      'blitzWalletUsers',
      ATTACKER_DOC_ID,
    );

    expect(data.uuid).toBe(ATTACKER_DOC_ID);
    expect(data.contacts.myProfile.uuid).toBe(ATTACKER_DOC_ID);
    expect(data.contacts.myProfile.name).toBe('Sneaky');
  });

  test('keeps stored uuids untouched when present', async () => {
    __store.set(`blitzWalletUsers/${ATTACKER_DOC_ID}`, {
      uuid: ATTACKER_DOC_ID,
      contacts: {
        myProfile: {
          uuid: ATTACKER_DOC_ID,
          name: 'Honest',
        },
      },
    });

    const data = await getDataFromCollection(
      'blitzWalletUsers',
      ATTACKER_DOC_ID,
    );

    expect(data.uuid).toBe(ATTACKER_DOC_ID);
    expect(data.contacts.myProfile.uuid).toBe(ATTACKER_DOC_ID);
  });

  test('only top-level uuid falls back when contacts.myProfile is absent', async () => {
    __store.set(`blitzWalletUsers/${ATTACKER_DOC_ID}`, {
      childAccounts: [],
    });

    const data = await getDataFromCollection(
      'blitzWalletUsers',
      ATTACKER_DOC_ID,
    );

    expect(data.uuid).toBe(ATTACKER_DOC_ID);
    expect(data.contacts).toBeUndefined();
  });

  test('survives a malformed non-map myProfile without throwing', async () => {
    __store.set(`blitzWalletUsers/${ATTACKER_DOC_ID}`, {
      contacts: { myProfile: 'not-a-map' },
    });

    const data = await getDataFromCollection(
      'blitzWalletUsers',
      ATTACKER_DOC_ID,
    );

    expect(data.uuid).toBe(ATTACKER_DOC_ID);
    expect(data.contacts.myProfile).toBe('not-a-map');
  });

  test('non-blitzWalletUsers collections are returned untouched', async () => {
    __store.set('blitzPools/some-pool', { poolId: 'some-pool' });

    const data = await getDataFromCollection('blitzPools', 'some-pool');

    expect(data).toEqual({ poolId: 'some-pool' });
    expect(data.uuid).toBeUndefined();
  });

  test('a missing doc returns undefined (pre-existing behavior, never throws)', async () => {
    expect(
      await getDataFromCollection('blitzWalletUsers', 'no-such-user'),
    ).toBeUndefined();
  });
});