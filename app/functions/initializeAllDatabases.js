import { initializeDatabase } from './messaging/cachedMessages';
import { initializeGiftCardDatabase } from './contacts/giftCardStorage';
import { initializePOSTransactionsDatabase } from './pos';
import { initializeSparkDatabase } from './spark/transactions';
import { initRootstockSwapDB } from './boltz/rootstock/swapDb';
import { initGiftDb } from './gift/giftsStorage';
import { initPoolDb } from './pools/poolsStorage';
import { initSavingsDb } from './savings/savingsStorage';
import { initLeavesDb } from './spark/leavesStorage';
import { documentDirectory, makeDirectoryAsync } from 'expo-file-system/legacy';
import { AppState, Platform } from 'react-native';
import { acquireWebDatabaseOwnership } from './webDatabaseOwnership';

export const DB_INIT_TIMEOUT_ERROR = 'dbInitTimeout';
const WEB_DB_INIT_TIMEOUT_MS = 20000;

let initPromise = null;
// Web: the rejection from a setup that timed out, kept for the page's lifetime.
let webInitTimeout = null;

// expo-sqlite's native ensureDirExists is TOCTOU-racy: when the SQLite dir does
// not exist yet, N concurrent openDatabaseAsync calls all see !isDirectory and
// race mkdirs(); the losers get mkdirs()==false while exists()==true and throw
// "Path already points to a non-normal file." (SQLiteHelpers.kt). On a fresh
// install our Promise.all fan-out below opens 9 DBs at once, so create the dir
// once up front — then every native ensureDirExists sees isDirectory and skips
// the race. intermediates:true is idempotent; best-effort so it never blocks.
async function ensureSQLiteDirExists() {
  try {
    await makeDirectoryAsync(`${documentDirectory}SQLite`, {
      intermediates: true,
    });
  } catch (err) {
    console.log('ensureSQLiteDirExists error', err);
  }
}

// Drops the memoized init so a later initializeAllDatabases() call re-runs the
// full CREATE TABLE pass. Needed after wipeLocalWalletData drops every table so
// the next call actually recreates them (on success the memoized promise would
// otherwise stay resolved forever and re-awaiting it would recreate nothing).
export function resetDatabaseInitialization() {
  initPromise = null;
}

// Web: rejects with DB_INIT_TIMEOUT_ERROR after `ms` in the foreground.
// expo-sqlite never answers if its worker script failed to load, so without a
// limit setup hangs forever. Background time doesn't count: a page is hidden
// before it is frozen, and a timer left running through a screen-off freeze
// could fire on resume ahead of the SQLite reply. Returning to the foreground
// restarts the full window.
function rejectAfterForegroundTime(ms) {
  let timer = null;
  let subscription = null;
  const promise = new Promise((_, reject) => {
    const start = () => {
      clearTimeout(timer);
      timer = setTimeout(() => reject(new Error(DB_INIT_TIMEOUT_ERROR)), ms);
    };
    subscription = AppState.addEventListener('change', state => {
      if (state === 'active') start();
      else clearTimeout(timer);
    });
    if (AppState.currentState === 'active') start();
  });
  const cancel = () => {
    clearTimeout(timer);
    subscription.remove();
  };
  return { promise, cancel };
}

// Sequential — one openDatabaseAsync + CREATE TABLE at a time.
// Startup-critical DBs (0, 3, 8) are opened first so a retry clears the
// memoized promise sooner if they fail; optional feature DBs follow.
async function openWebDatabases() {
  const results = [];
  results[0] = await initializeDatabase(); // startup-critical
  await new Promise(res => setTimeout(res, 50));
  results[1] = await initializeGiftCardDatabase();
  await new Promise(res => setTimeout(res, 50));
  results[2] = await initializePOSTransactionsDatabase();
  await new Promise(res => setTimeout(res, 50));
  results[3] = await initializeSparkDatabase(); // startup-critical
  await new Promise(res => setTimeout(res, 50));
  results[4] = await initRootstockSwapDB();
  await new Promise(res => setTimeout(res, 50));
  results[5] = await initGiftDb();
  await new Promise(res => setTimeout(res, 50));
  results[6] = await initPoolDb();
  await new Promise(res => setTimeout(res, 50));
  results[7] = await initSavingsDb();
  await new Promise(res => setTimeout(res, 50));
  results[8] = await initLeavesDb(); // startup-critical
  return results;
}

// Opens + creates every local SQLite table the in-account experience needs.
// Memoized so it runs once regardless of how many callers await it. Kicked off
// (non-blocking) from the splash screen and awaited by the post-login loading
// screen before any cached DB read, so login never waits on database work.
export function initializeAllDatabases() {
  // After a web timeout the abandoned open sequence may still be running, and
  // expo-sqlite keeps its stalled worker for the page's lifetime. Never start
  // another sequence, not even after resetDatabaseInitialization (the wipe
  // calls it); reloading the page is the recovery.
  if (webInitTimeout) return webInitTimeout;
  if (!initPromise) {
    initPromise = (async () => {
      if (Platform.OS === 'web') {
        // Single-tab ownership BEFORE touching SQLite: a second tab that opens
        // the same OPFS databases poisons its worker ("Invalid VFS state"), so
        // non-owners throw dbTabConflictError and never reach openDatabaseAsync.
        try {
          await acquireWebDatabaseOwnership();
        } catch (err) {
          initPromise = null;
          throw err;
        }
        const timeout = rejectAfterForegroundTime(WEB_DB_INIT_TIMEOUT_MS);
        let results;
        try {
          results = await Promise.race([openWebDatabases(), timeout.promise]);
        } catch (err) {
          if (err?.message === DB_INIT_TIMEOUT_ERROR) {
            webInitTimeout = Promise.reject(err);
            webInitTimeout.catch(() => {});
          }
          throw err;
        } finally {
          timeout.cancel();
        }

        // Only the three startup-critical DBs (messages, spark, leaves) must
        // succeed to load the wallet. Optional feature DBs self-init on first
        // use, so a failure here must not block login or the memoized retry.
        if (!results[0] || !results[3] || !results[8]) {
          initPromise = null; // allow a later retry to re-attempt
          throw new Error('dbInitError');
        }
        return true;
      }
      await ensureSQLiteDirExists();
      const results = await Promise.all([
        initializeDatabase(), // 0 — startup-critical
        initializeGiftCardDatabase(),
        initializePOSTransactionsDatabase(),
        initializeSparkDatabase(), // 3 — startup-critical
        initRootstockSwapDB(),
        initGiftDb(),
        initPoolDb(),
        initSavingsDb(),
        initLeavesDb(), // 8 — startup-critical
      ]);
      // Only the three startup-critical DBs (messages, spark, leaves) must
      // succeed to load the wallet. Optional feature DBs self-init on first
      // use, so a failure here must not block login or the memoized retry.
      if (!results[0] || !results[3] || !results[8]) {
        initPromise = null; // allow a later retry to re-attempt
        throw new Error('dbInitError');
      }
      return true;
    })();
  }
  return initPromise;
}
