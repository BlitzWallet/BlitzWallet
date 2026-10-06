jest.mock('../../../app/functions/handleEventEmitters', () => ({
  handleEventEmitterPost: jest.fn(),
}));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

// Fresh module state per test so module-level initPromise/rawDB don't leak.
function loadModule() {
  let openDatabaseAsync;
  let getAllUnpaidSparkLightningInvoices;
  jest.isolateModules(() => {
    ({ openDatabaseAsync } = require('expo-sqlite'));
    ({
      getAllUnpaidSparkLightningInvoices,
    } = require('../../../app/functions/spark/transactions'));
  });
  return { openDatabaseAsync, getAllUnpaidSparkLightningInvoices };
}

describe('spark tx DB self-heal on released native handle', () => {
  it('reopens and retries when the handle was released', async () => {
    const { openDatabaseAsync, getAllUnpaidSparkLightningInvoices } =
      loadModule();
    const dead = {
      getAllAsync: jest
        .fn()
        .mockRejectedValue(
          new Error(
            "Call to function 'NativeDatabase.prepareAsync' has been rejected.\nCannot use shared object that was already released",
          ),
        ),
    };
    const fresh = { getAllAsync: jest.fn().mockResolvedValue([{ id: 1 }]) };
    openDatabaseAsync
      .mockResolvedValueOnce(dead)
      .mockResolvedValueOnce(fresh);

    const result = await getAllUnpaidSparkLightningInvoices();

    expect(result).toEqual([{ id: 1 }]);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
    expect(dead.getAllAsync).toHaveBeenCalledTimes(1);
    expect(fresh.getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('does not reopen on unrelated errors', async () => {
    const { openDatabaseAsync, getAllUnpaidSparkLightningInvoices } =
      loadModule();
    // Android wraps every native failure as "… has been rejected".
    const handle = {
      getAllAsync: jest
        .fn()
        .mockRejectedValue(
          new Error(
            "Call to function 'NativeStatement.getAllAsync' has been rejected.\n→ Caused by: Error code 1: no such table",
          ),
        ),
    };
    openDatabaseAsync.mockResolvedValueOnce(handle);

    // getAllUnpaidSparkLightningInvoices swallows errors -> returns undefined
    const result = await getAllUnpaidSparkLightningInvoices();

    expect(result).toBeUndefined();
    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(handle.getAllAsync).toHaveBeenCalledTimes(1);
  });
});

// Android expo-sqlite 16.0.8 semantics, from SQLiteModule.kt / NativeDatabase.kt
// and expo-modules-core (expo/expo#48999):
//  - a plain open of an already-open path returns the CACHED native database
//    wrapped in a NEW JS object (useNewConnection bypasses the cache);
//  - GC of any wrapper runs sharedObjectDidRelease -> ref.close(), killing the
//    native binding every other wrapper of that database shares, and the dead
//    object stays cached for the life of the process;
//  - every native failure is rejected as "Call to function '…' has been rejected".
// One instance = one app process; `rows` is the database file on disk.
function androidSqlite(rows) {
  const cache = new Map();
  const wrappers = [];
  let failNextWith = null;
  const rejected = (fn, cause) =>
    new Error(`Call to function '${fn}' has been rejected.\n→ Caused by: ${cause}`);

  return {
    async openDatabaseAsync(name, options = {}) {
      let native = options.useNewConnection ? null : cache.get(name);
      if (!native) {
        native = { alive: true };
        if (!options.useNewConnection) cache.set(name, native);
      }
      const wrapper = {
        native,
        async getAllAsync() {
          if (!native.alive) {
            throw rejected(
              'NativeDatabase.prepareAsync',
              'java.lang.NullPointerException: java.lang.NullPointerException',
            );
          }
          if (failNextWith) {
            const cause = failNextWith;
            failNextWith = null;
            throw rejected('NativeStatement.getAllAsync', cause);
          }
          return rows;
        },
      };
      wrappers.push(wrapper);
      return wrapper;
    },
    failNextQuery: cause => (failNextWith = cause),
    // Hermes collects every wrapper the app no longer references; the
    // self-healing connection only ever holds the last one it opened.
    gc: () => wrappers.slice(0, -1).forEach(w => (w.native.alive = false)),
    killOpenConnection: () => (wrappers.at(-1).native.alive = false),
  };
}

function startApp(rows) {
  const sqlite = androidSqlite(rows);
  let getAllSparkTransactions;
  jest.isolateModules(() => {
    require('expo-sqlite').openDatabaseAsync.mockImplementation(
      sqlite.openDatabaseAsync,
    );
    ({
      getAllSparkTransactions,
    } = require('../../../app/functions/spark/transactions'));
  });
  return { sqlite, getAllSparkTransactions };
}

describe('Android: transaction history across a transient SQLite error', () => {
  const rows = [
    { id: 1, sparkID: 'a', accountId: 'acct', details: '{}' },
    { id: 2, sparkID: 'b', accountId: 'acct', details: '{}' },
  ];

  it('history stays visible after one ordinary SQLite error and a GC', async () => {
    const { sqlite, getAllSparkTransactions } = startApp(rows);
    const viewAll = () => getAllSparkTransactions({ accountId: 'acct' });

    expect(await viewAll()).toEqual(rows);

    sqlite.failNextQuery('Error code 5: database is locked');
    await viewAll(); // this one read may fail; it must not poison the next
    sqlite.gc();

    expect(await viewAll()).toEqual(rows);
  });

  it('a force-closed and reopened app sees the same rows (file untouched)', async () => {
    const first = startApp(rows);
    first.sqlite.failNextQuery('Error code 5: database is locked');
    await first.getAllSparkTransactions({ accountId: 'acct' });
    first.sqlite.gc();

    const relaunched = startApp(rows);
    expect(
      await relaunched.getAllSparkTransactions({ accountId: 'acct' }),
    ).toEqual(rows);
  });

  it('recovers when the native connection really died', async () => {
    const { sqlite, getAllSparkTransactions } = startApp(rows);
    expect(await getAllSparkTransactions({ accountId: 'acct' })).toEqual(rows);

    sqlite.killOpenConnection();

    expect(await getAllSparkTransactions({ accountId: 'acct' })).toEqual(rows);
  });
});
