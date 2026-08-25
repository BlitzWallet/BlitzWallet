/* eslint-env jest */
// Exercises the REAL pairing session db layer (createPairingSession /
// advanceSessionStatus / cancelPairingSession) against a tiny in-memory Firestore
// mock, plus claimPairingSession (the child's discover+claim, which goes through
// the rate-limited proxy endpoint over fetch, NOT Firestore). There is no pointer
// doc: the session doc id IS the parent's 6-digit pairing code, so the code is
// the secret rendezvous. The client can no longer read or claim the session doc
// directly (get oracle + WAITING→JOINED write oracle are closed in the rules).

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

// blitzProxyFetch (used by claimPairingSession) calls getAuth() + getIdToken;
// the global jest.setup.js auth mock exports neither a stable instance nor
// getIdToken, so provide a singleton here that the tests can mutate via
// firebaseAuth below.
jest.mock('@react-native-firebase/auth', () => {
  const authInstance = { currentUser: null };
  return {
    __esModule: true,
    getAuth: jest.fn(() => authInstance),
    getIdToken: jest.fn(async () => 'child-tok'),
  };
});

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
    // changed since the tx read it.
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
  claimPairingSession,
  advanceSessionStatus,
  cancelPairingSession,
} = require('../../db');
const { firebaseAuth } = require('../../db/initializeFirebase');
const { __store, __overwriteAfterRead } = require('@react-native-firebase/firestore');

const RID = 'alice';
const PARENT = 'parent-pub';
const CHILD = 'child-pub';

const sessionKey = sid => `familyPairing/alice/sessions/${sid}`;

beforeEach(() => {
  __store.clear();
  __overwriteAfterRead.set(null);
});

describe('createPairingSession', () => {
  test('creates a WAITING session under the 6-digit code and returns the code', async () => {
    const code = await createPairingSession(RID, PARENT, {
      commit: 'commit-hex',
    });
    expect(code).toMatch(/^[0-9]{6}$/);

    const session = __store.get(sessionKey(code));
    expect(session).toMatchObject({
      v: 1,
      status: 'WAITING',
      parentWalletPub: PARENT,
      childUid: null,
      commit: 'commit-hex',
    });
    expect(session.createdAt.__serverTimestamp).toBe(true);
    expect(session.expireAt.toMillis()).toBeGreaterThan(Date.now());

    // No pointer doc anywhere: familyPairing/{rid} must not exist.
    expect(__store.has('familyPairing/alice')).toBe(false);
  });

  test('each call opens an independent session (no one-live-session conflict)', async () => {
    const a = await createPairingSession(RID, PARENT, { commit: 'c1' });
    const b = await createPairingSession(RID, PARENT, { commit: 'c2' });
    expect(a).not.toBe(b);
    // Both session docs exist independently under their own codes.
    expect(__store.get(sessionKey(a))).toMatchObject({ status: 'WAITING' });
    expect(__store.get(sessionKey(b))).toMatchObject({ status: 'WAITING' });
  });
});

// Seed a session straight to JOINED (the claim now happens admin-side via the
// proxy, so there is no client joinPairingSession to drive it in-process).
function seedJoined(sid) {
  __store.set(sessionKey(sid), {
    ...__store.get(sessionKey(sid)),
    status: 'JOINED',
    childUid: CHILD,
    joinedAt: { __serverTimestamp: true },
  });
}

describe('claimPairingSession (proxy discover+claim)', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    firebaseAuth.currentUser = null;
  });

  test('POSTs name+code with the child ID token and returns the commit on success', async () => {
    firebaseAuth.currentUser = { getIdToken: jest.fn(async () => 'child-tok') };
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'SUCCESS', commit: 'commit-hex' }),
    }));

    const result = await claimPairingSession(RID, '482916');
    expect(result).toEqual({ ok: true, commit: 'commit-hex' });

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://proxy.blitz-wallet.com/childPairingClaim');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer child-tok');
    expect(JSON.parse(opts.body)).toEqual({ name: RID, code: '482916' });
  });

  test('a non-200 maps the server error code to { ok:false, error }', async () => {
    firebaseAuth.currentUser = { getIdToken: jest.fn(async () => 't') };
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ status: 'DENIED', error: 'rate_limited' }),
    }));
    expect(await claimPairingSession(RID, '482916')).toEqual({
      ok: false,
      error: 'rate_limited',
    });
  });

  test('a transport failure returns { ok:false, error } (never throws)', async () => {
    firebaseAuth.currentUser = { getIdToken: jest.fn(async () => 't') };
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    });
    const result = await claimPairingSession(RID, '482916');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('request_failed');
  });
});

describe('advanceSessionStatus / cancelPairingSession', () => {
  test('advance VERIFYING then COMPLETED stamps the matching timestamps', async () => {
    const sid = await createPairingSession(RID, PARENT, { commit: 'c' });
    seedJoined(sid);
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
