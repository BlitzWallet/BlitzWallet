/* eslint-env jest */
// Exercises the REAL pairing session db layer (createPairingSession /
// joinPairingSession / advanceSessionStatus / cancelPairingSession /
// removeRendezvous / getPairingPointer) against a tiny in-memory Firestore
// mock. The mock's runTransaction models optimistic concurrency (a delete is
// aborted if the doc changed since the tx's read), which is exactly what the
// D3 removeRendezvous TOCTOU fix depends on.

jest.mock('../../app/functions/crashlyticsLogs', () => ({
  __esModule: true,
  crashlyticsLogReport: jest.fn(),
  crashlyticsRecordErrorReport: jest.fn(),
}));

// db/index.js pulls a heavy import graph (SQLite, the app/functions barrel, the
// messaging chain). Stub the leaves the pairing helpers never touch so the
// module loads under jest.
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
  // When set, the next tx.get of `key` applies `data` to the store immediately
  // AFTER recording the read — simulating a concurrent write that commits
  // between the transaction's read and its delete (D3).
  let overwriteAfterRead = null;
  const snapFor = key => ({
    exists: () => store.has(key),
    data: () => store.get(key),
  });
  const keyOf = ref => ref._key;
  return {
    __esModule: true,
    __store: store,
    __overwriteAfterRead: {
      set: v => {
        overwriteAfterRead = v;
      },
    },
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
    // Mirrors Firestore's optimistic concurrency: a write is aborted if the doc
    // changed since the tx read it. This is the property removeRendezvous (D3)
    // relies on — a plain read-then-delete would pass here and nuke a newer
    // pointer in production.
    runTransaction: async (_db, fn) => {
      const readVersions = new Map();
      const tx = {
        get: async ref => {
          const key = keyOf(ref);
          // Firestore snapshots are immutable: capture the doc at read time so
          // the transaction sees a stable view even if the store mutates
          // afterwards (the D3 overwrite below).
          const data = store.get(key);
          readVersions.set(key, data);
          if (overwriteAfterRead && overwriteAfterRead.key === key) {
            store.set(key, overwriteAfterRead.data);
            overwriteAfterRead = null;
          }
          return { exists: () => data !== undefined, data: () => data };
        },
        set: (ref, data) => {
          store.set(keyOf(ref), data);
        },
        delete: ref => {
          const key = keyOf(ref);
          if (readVersions.has(key) && store.get(key) !== readVersions.get(key)) {
            throw new Error('ABORTED: concurrent modification');
          }
          store.delete(key);
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
  createPairingSession,
  joinPairingSession,
  advanceSessionStatus,
  cancelPairingSession,
  removeRendezvous,
  getPairingPointer,
} = require('../../db');
const { __store, __overwriteAfterRead } = require('@react-native-firebase/firestore');

const RID = 'alice';
const PARENT = 'parent-pub';
const CHILD = 'child-pub';

const pointerKey = 'familyPairing/alice';
const sessionKey = sid => `familyPairing/alice/sessions/${sid}`;

const pointerOf = async () => __store.get(pointerKey);

beforeEach(() => {
  __store.clear();
  __overwriteAfterRead.set(null);
});

describe('createPairingSession', () => {
  test('creates a WAITING session + pointer atomically and returns the sessionId', async () => {
    const sid = await createPairingSession(RID, PARENT, {
      commit: 'commit-hex',
    });
    expect(typeof sid).toBe('string');

    const session = __store.get(sessionKey(sid));
    expect(session).toMatchObject({
      v: 1,
      status: 'WAITING',
      parentWalletPub: PARENT,
      childUid: null,
      commit: 'commit-hex',
    });
    expect(session.createdAt.__serverTimestamp).toBe(true);
    expect(session.expireAt.toMillis()).toBeGreaterThan(Date.now());

    const pointer = await pointerOf();
    expect(pointer).toMatchObject({
      v: 1,
      sessionId: sid,
      commit: 'commit-hex',
      parentWalletPub: PARENT,
    });
  });

  test('each call opens an independent session (no one-live-session conflict)', async () => {
    const a = await createPairingSession(RID, PARENT, { commit: 'c1' });
    const b = await createPairingSession(RID, PARENT, { commit: 'c2' });
    expect(a).not.toBe(b);
    // Both session docs exist independently; the pointer just names the newest.
    expect(__store.get(sessionKey(a))).toMatchObject({ status: 'WAITING' });
    expect(__store.get(sessionKey(b))).toMatchObject({ status: 'WAITING' });
    expect((await pointerOf()).sessionId).toBe(b);
  });
});

describe('joinPairingSession / advanceSessionStatus / cancelPairingSession', () => {
  test('join stamps JOINED + childUid + serverTimestamp joinedAt', async () => {
    const sid = await createPairingSession(RID, PARENT, { commit: 'c' });
    expect(await joinPairingSession(RID, sid, CHILD)).toBe(true);
    const session = __store.get(sessionKey(sid));
    expect(session).toMatchObject({
      status: 'JOINED',
      childUid: CHILD,
    });
    expect(session.joinedAt.__serverTimestamp).toBe(true);
  });

  test('join on a missing session is denied (returns false, never throws)', async () => {
    expect(await joinPairingSession(RID, 'no-such-session', CHILD)).toBe(false);
  });

  test('advance VERIFYING then COMPLETED stamps the matching timestamps', async () => {
    const sid = await createPairingSession(RID, PARENT, { commit: 'c' });
    await joinPairingSession(RID, sid, CHILD);
    expect(await advanceSessionStatus(RID, sid, 'VERIFYING')).toBe(true);
    let session = __store.get(sessionKey(sid));
    expect(session.status).toBe('VERIFYING');
    expect(session.verifyingAt.__serverTimestamp).toBe(true);
    expect(session.joinedAt.__serverTimestamp).toBe(true);

    expect(await advanceSessionStatus(RID, sid, 'COMPLETED')).toBe(true);
    session = __store.get(sessionKey(sid));
    expect(session.status).toBe('COMPLETED');
    expect(session.completedAt.__serverTimestamp).toBe(true);
  });

  test('cancelPairingSession flips a non-terminal session to CANCELLED', async () => {
    const sid = await createPairingSession(RID, PARENT, { commit: 'c' });
    expect(await cancelPairingSession(RID, sid)).toBe(true);
    expect(__store.get(sessionKey(sid)).status).toBe('CANCELLED');
  });
});

describe('removeRendezvous (D3 — TOCTOU-free pointer delete)', () => {
  test('deletes the pointer when it still points at our sessionId', async () => {
    const sid = await createPairingSession(RID, PARENT, { commit: 'c' });
    expect(await removeRendezvous(RID, sid)).toBe(true);
    expect(await getPairingPointer(RID)).toBeNull();
  });

  test('leaves the pointer intact when it points at a different sessionId', async () => {
    const sid = await createPairingSession(RID, PARENT, { commit: 'c' });
    await createPairingSession(RID, PARENT, { commit: 'c2' }); // pointer now → new sid
    expect(await removeRendezvous(RID, sid)).toBe(true);
    const pointer = await pointerOf();
    expect(pointer).toBeTruthy();
    expect(pointer.sessionId).not.toBe(sid);
  });

  test('D3: a concurrent pointer replacement between read and delete is never nuked', async () => {
    const sidA = await createPairingSession(RID, PARENT, { commit: 'cA' });
    // A second parent device commits a new pointer between this tx's read and
    // its delete. The optimistic-concurrency model aborts the tx instead of
    // deleting the newer pointer.
    __overwriteAfterRead.set({
      key: pointerKey,
      data: { ...(await pointerOf()), sessionId: 'sess-B-concurrent' },
    });
    expect(await removeRendezvous(RID, sidA)).toBe(false);
    const pointer = await pointerOf();
    expect(pointer).toBeTruthy();
    expect(pointer.sessionId).toBe('sess-B-concurrent');
  });

  test('removeRendezvous on an already-missing pointer is a clean no-op', async () => {
    const sid = await createPairingSession(RID, PARENT, { commit: 'c' });
    await removeRendezvous(RID, sid);
    expect(await removeRendezvous(RID, sid)).toBe(true);
  });
});
