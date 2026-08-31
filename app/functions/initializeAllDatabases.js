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

let initPromise = null;

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

// Opens + creates every local SQLite table the in-account experience needs.
// Memoized so it runs once regardless of how many callers await it. Kicked off
// (non-blocking) from the splash screen and awaited by the post-login loading
// screen before any cached DB read, so login never waits on database work.
export function initializeAllDatabases() {
  if (!initPromise) {
    initPromise = (async () => {
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
