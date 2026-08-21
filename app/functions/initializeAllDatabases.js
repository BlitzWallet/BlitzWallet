import { initializeDatabase } from './messaging/cachedMessages';
import { initializeGiftCardDatabase } from './contacts/giftCardStorage';
import { initializePOSTransactionsDatabase } from './pos';
import { initializeSparkDatabase } from './spark/transactions';
import { initRootstockSwapDB } from './boltz/rootstock/swapDb';
import { initGiftDb } from './gift/giftsStorage';
import { initPoolDb } from './pools/poolsStorage';
import { initSavingsDb } from './savings/savingsStorage';
import { initLeavesDb } from './spark/leavesStorage';
import { initBTCMapDB } from './btcMap/btcMapStorage';

let initPromise = null;

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
      const results = [];

      results.push(await initializeDatabase());
      results.push(await initializeGiftCardDatabase());
      results.push(await initializePOSTransactionsDatabase());
      results.push(await initializeSparkDatabase());
      results.push(await initRootstockSwapDB());
      results.push(await initGiftDb());
      results.push(await initPoolDb());
      results.push(await initSavingsDb());
      results.push(await initLeavesDb());
      results.push(await initBTCMapDB());
      if (results.some(result => !result)) {
        initPromise = null;
        throw new Error('dbInitError');
      }
      return true;
    })();
  }
  return initPromise;
}
