import { initializeDatabase } from './messaging/cachedMessages';
import { initializeGiftCardDatabase } from './contacts/giftCardStorage';
import { initializePOSTransactionsDatabase } from './pos';
import { initializeSparkDatabase } from './spark/transactions';
import { initRootstockSwapDB } from './boltz/rootstock/swapDb';
import { initGiftDb } from './gift/giftsStorage';
import { initPoolDb } from './pools/poolsStorage';
import { initSavingsDb } from './savings/savingsStorage';

let initPromise = null;

// Opens + creates every local SQLite table the in-account experience needs.
// Memoized so it runs once regardless of how many callers await it. Kicked off
// (non-blocking) from the splash screen and awaited by the post-login loading
// screen before any cached DB read, so login never waits on database work.
export function initializeAllDatabases() {
  if (!initPromise) {
    initPromise = (async () => {
      const results = await Promise.all([
        initializeDatabase(),
        initializeGiftCardDatabase(),
        initializePOSTransactionsDatabase(),
        initializeSparkDatabase(),
        initRootstockSwapDB(),
        initGiftDb(),
        initPoolDb(),
        initSavingsDb(),
      ]);
      if (results.some(result => !result)) {
        initPromise = null; // allow a later retry to re-attempt
        throw new Error('dbInitError');
      }
      return true;
    })();
  }
  return initPromise;
}
