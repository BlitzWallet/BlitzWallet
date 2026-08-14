/* eslint-env jest */
// Exercises the REAL reservation helpers (claimUniqueName /
// ownsUniqueNameReservation / isUniqueNameAvailable) in db/index.js against a
// tiny in-memory Firestore mock (doc/getDoc/runTransaction/getDocs).

jest.mock('../../../app/functions/crashlyticsLogs', () => ({
  __esModule: true,
  crashlyticsLogReport: jest.fn(),
  crashlyticsRecordErrorReport: jest.fn(),
}));

// db/index.js pulls a heavy import graph (SQLite, the app/functions barrel, the
// messaging chain). Stub the leaves the reservation helpers never touch so the
// module loads under jest.
jest.mock('../../../app/functions/messaging/cachedMessages', () => ({
  __esModule: true,
  getCachedMessages: jest.fn(),
  queueSetCashedMessages: jest.fn(),
}));
jest.mock('../../../app/functions', () => ({
  __esModule: true,
  getLocalStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn(),
}));
jest.mock('../../../app/functions/messaging/encodingAndDecodingMessages', () => ({
  __esModule: true,
  decryptMessage: jest.fn(),
  encriptMessage: jest.fn(),
}));
jest.mock('../../../app/functions/accounts/childAccounts', () => ({
  __esModule: true,
  getNextChildDerivationIndex: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => {
  const store = new Map();
  const snap = key => ({ exists: () => store.has(key), data: () => store.get(key) });
  return {
    __esModule: true,
    __store: store,
    getFirestore: () => ({}),
    doc: (_db, col, id) => ({ _key: `${col}/${id}` }),
    collection: (_db, col) => ({ _col: col }),
    query: (...args) => ({ _q: args }),
    where: (field, op, val) => ({ field, op, val }),
    getDoc: async ref => snap(ref._key),
    getDocs: async () => ({ empty: true, docs: [] }), // blitzWalletUsers unseeded
    setDoc: async (ref, data) => {
      store.set(ref._key, data);
    },
    deleteDoc: async ref => {
      store.delete(ref._key);
    },
    runTransaction: async (_db, fn) => {
      const tx = {
        get: async ref => snap(ref._key),
        // Mirror `usernames/` rules: create is allowed, update is denied
        // (`allow update: if false`). A set on an existing doc is an update, so
        // reject it — this is the guard that catches a regression of the
        // create-only self-reclaim fix (the emulator suite in Fix 4 is the
        // authoritative check; this is the one that runs under jest today).
        set: (ref, data) => {
          if (store.has(ref._key)) {
            throw new Error('PERMISSION_DENIED: update denied on existing doc');
          }
          store.set(ref._key, data);
        },
        delete: ref => store.delete(ref._key),
      };
      return fn(tx);
    },
    // Unused-at-runtime stubs for the rest of db/index.js's imports.
    addDoc: jest.fn(),
    writeBatch: jest.fn(),
    increment: jest.fn(),
    serverTimestamp: jest.fn(),
    Timestamp: {},
    onSnapshot: jest.fn(),
    limit: jest.fn(),
    or: jest.fn(),
    orderBy: jest.fn(),
  };
});

const {
  claimUniqueName,
  ownsUniqueNameReservation,
  isUniqueNameAvailable,
} = require('../../../db');
const { __store } = require('@react-native-firebase/firestore');

beforeEach(() => {
  __store.clear();
});

test('first claim succeeds and is owned by the caller', async () => {
  expect(await claimUniqueName('uidA', null, 'Alice')).toEqual({ status: 'ok' });
  expect(await ownsUniqueNameReservation('uidA', 'alice')).toBe(true);
  expect(await ownsUniqueNameReservation('uidB', 'alice')).toBe(false);
});

test('second uid gets NAME_TAKEN and its old reservation is untouched', async () => {
  await claimUniqueName('uidA', null, 'alice');
  await claimUniqueName('uidB', null, 'bobold');

  const res = await claimUniqueName('uidB', 'bobold', 'alice');
  expect(res).toEqual({ status: 'NAME_TAKEN' });
  // uidB still owns its previous reservation (never orphaned on a failed claim).
  expect(await ownsUniqueNameReservation('uidB', 'bobold')).toBe(true);
  // uidA still owns alice.
  expect(await ownsUniqueNameReservation('uidA', 'alice')).toBe(true);
});

test('successful rename releases the old reservation', async () => {
  await claimUniqueName('uidA', null, 'oldname');
  const res = await claimUniqueName('uidA', 'oldname', 'newname');
  expect(res).toEqual({ status: 'ok' });
  expect(await ownsUniqueNameReservation('uidA', 'newname')).toBe(true);
  expect(await ownsUniqueNameReservation('uidA', 'oldname')).toBe(false);
});

test('self-reclaim of an own reservation returns ok', async () => {
  await claimUniqueName('uidA', null, 'alice');
  expect(await claimUniqueName('uidA', null, 'alice')).toEqual({ status: 'ok' });
  expect(await ownsUniqueNameReservation('uidA', 'alice')).toBe(true);
});

test('rename back to a name the caller already owns returns ok (create-only)', async () => {
  // The P1 case: an orphaned but self-owned reservation still exists, and the
  // user renames back to it. A blind tx.set would be an update → rules-denied.
  await claimUniqueName('uidA', null, 'bob'); // owned, orphaned reservation lingers
  await claimUniqueName('uidA', null, 'alice'); // current name (no oldLower → bob kept)
  const res = await claimUniqueName('uidA', 'alice', 'bob');
  expect(res).toEqual({ status: 'ok' });
  expect(await ownsUniqueNameReservation('uidA', 'bob')).toBe(true);
  expect(await ownsUniqueNameReservation('uidA', 'alice')).toBe(false);
});

test('case-only rename with an existing self-owned reservation returns ok', async () => {
  // oldId === newId after normalization, reservation already owned → no-op ok,
  // never an update-denied.
  await claimUniqueName('uidA', null, 'Alice');
  const res = await claimUniqueName('uidA', 'Alice', 'alice');
  expect(res).toEqual({ status: 'ok' });
  expect(await ownsUniqueNameReservation('uidA', 'alice')).toBe(true);
});

test('concurrent claims of the same name: exactly one wins, loser keeps its old reservation', async () => {
  // Two new clients race for the same free name. Firestore serializes the
  // transactions; the loser reads the winner's committed doc and returns
  // NAME_TAKEN. The in-memory tx uses live snapshots (exists() re-reads the
  // store), so this models the serialized outcome deterministically.
  await claimUniqueName('uidA', null, 'aold');
  await claimUniqueName('uidB', null, 'bold');

  const [resA, resB] = await Promise.all([
    claimUniqueName('uidA', 'aold', 'shared'),
    claimUniqueName('uidB', 'bold', 'shared'),
  ]);

  // Exactly one 'ok', one 'NAME_TAKEN' — never two winners, never two errors.
  expect([resA.status, resB.status].sort()).toEqual(['NAME_TAKEN', 'ok']);

  // Exactly one uid owns the contested name.
  const aOwns = await ownsUniqueNameReservation('uidA', 'shared');
  const bOwns = await ownsUniqueNameReservation('uidB', 'shared');
  expect(aOwns).not.toBe(bOwns);

  // Winner released its old reservation; loser never orphaned its own.
  if (resA.status === 'ok') {
    expect(await ownsUniqueNameReservation('uidA', 'aold')).toBe(false);
    expect(await ownsUniqueNameReservation('uidB', 'bold')).toBe(true);
  } else {
    expect(await ownsUniqueNameReservation('uidB', 'bold')).toBe(false);
    expect(await ownsUniqueNameReservation('uidA', 'aold')).toBe(true);
  }
});

test('isUniqueNameAvailable: free, self-owned, and taken', async () => {
  // Free (no reservation, blitzWalletUsers query empty).
  expect(await isUniqueNameAvailable('uidA', 'alice')).toBe(true);

  await claimUniqueName('uidA', null, 'alice');
  // Self-reclaim: owned by the same uid → still available.
  expect(await isUniqueNameAvailable('uidA', 'alice')).toBe(true);
  // Taken by someone else.
  expect(await isUniqueNameAvailable('uidB', 'alice')).toBe(false);
});
