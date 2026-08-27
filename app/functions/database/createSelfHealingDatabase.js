import { openDatabaseAsync } from 'expo-sqlite';

// Shared factory for our local SQLite databases.
//
// The native SQLite object can be released out from under the JS handle (JS
// bundle reload in dev, Android host teardown, memory pressure). When that
// happens the cached handle is dead but the "ready" flag stays true, so every
// query throws "Cannot use shared object that was already released" until a
// full app restart. Each connection built here wraps its handle so query
// methods detect that error, drop the dead handle, reopen (re-running `setup`),
// and retry the failed call once.
//
// NOT used by the NWC databases (cachedNWCTxs, eventLedger): they manage their
// own lifecycle.
//
// Usage:
//   const conn = createSelfHealingDatabase({ name: 'FOO.db', setup });
//   const sqlLiteDB = conn.db;            // stable proxy; use everywhere
//   export const ensureFooReady = () => conn.ensureReady();
//   export const initFooDb = async () => { try { await conn.reinitialize(); return true; } catch { return false; } };

const RELEASED_ERROR_RE = /already released|has been rejected/i;

// Methods routed through the self-heal retry. A released-handle error is thrown
// before the statement runs, so retrying after reopening is safe: the failed
// call never touched the database.
const HEALING_METHODS = new Set([
  'getAllAsync',
  'getFirstAsync',
  'runAsync',
  'execAsync',
]);

/**
 * @param {object} opts
 * @param {string} opts.name - database file name, e.g. `MY_DB.db`.
 * @param {(db: import('expo-sqlite').SQLiteDatabase) => Promise<void>} [opts.setup]
 *   Idempotent schema/pragma creation, run after every (re)open. Runs against
 *   the raw handle. Omit for databases whose schema is created separately.
 */
export function createSelfHealingDatabase({ name, setup }) {
  let rawDB = null;
  let isReady = false;
  let readyPromise = null;

  function ensureReady() {
    if (!readyPromise) {
      readyPromise = (async () => {
        if (!rawDB) rawDB = await openDatabaseAsync(name);
        if (setup) {
          try {
            await setup(rawDB);
          } catch (error) {
            // setup runs raw (unproxied) queries — e.g. setupPoolsSchema /
            // setupLeavesSchema call execAsync directly on the handle. The
            // native handle can die between open and setup (OOM, or GC of a
            // sibling wrapper — expo/expo#48999), so the released-handle error
            // surfaces here, outside the query self-heal, as
            // "NativeDatabase.execAsync has been rejected". Drop the dead
            // handle, reopen once, and re-run setup — same recovery runHealing
            // gives queries.
            if (!RELEASED_ERROR_RE.test(String(error?.message))) throw error;
            rawDB = await openDatabaseAsync(name);
            await setup(rawDB);
          }
        }
        isReady = true;
        return db;
      })().catch(error => {
        // Don't cache a rejected open/setup forever; let a later call retry.
        readyPromise = null;
        isReady = false;
        throw error;
      });
    }
    return readyPromise;
  }

  // Force `setup` to re-run (recreate schema) on the current connection. Used
  // by the exported init* functions, which are also the post-wipe recreate
  // path (a live connection whose tables were just dropped).
  function reinitialize() {
    readyPromise = null;
    isReady = false;
    return ensureReady();
  }

  // Mark stale without touching the handle so the next ensureReady() re-runs
  // setup. For teardown paths that DROP tables on the live connection.
  function invalidate() {
    readyPromise = null;
    isReady = false;
  }

  async function runHealing(method, args) {
    await ensureReady();
    try {
      return await rawDB[method](...args);
    } catch (error) {
      if (!RELEASED_ERROR_RE.test(String(error?.message))) throw error;
      // Native handle was released. Drop it, reopen (re-running setup), retry.
      rawDB = null;
      readyPromise = null;
      isReady = false;
      await ensureReady();
      return rawDB[method](...args);
    }
  }

  // Stable proxy so call sites keep a single reference across reopens: query
  // methods self-heal, everything else passes through to the live handle.
  const db = new Proxy(
    {},
    {
      get(_target, prop) {
        if (HEALING_METHODS.has(prop)) {
          return (...args) => runHealing(prop, args);
        }
        const value = rawDB?.[prop];
        return typeof value === 'function' ? value.bind(rawDB) : value;
      },
    },
  );

  return {
    db,
    ensureReady,
    reinitialize,
    invalidate,
    isOpen: () => isReady,
  };
}
