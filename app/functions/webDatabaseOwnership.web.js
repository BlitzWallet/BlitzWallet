// Origin-wide single-tab ownership for the OPFS-backed SQLite worker on web.
//
// expo-sqlite's web backend (wa-sqlite + AccessHandlePoolVFS) acquires
// exclusive synchronous OPFS handles per origin. A second tab that opens the
// same databases fails with NoModificationAllowedError, and the installed
// worker sets `_sqlite3` before VFS creation, so a failed open poisons the
// worker ("Invalid VFS state" on every retry until reload).
//
// Mechanism: an exclusive Web Lock held for the tab's lifetime. The browser
// releases it when the tab closes or crashes, background timer throttling and
// tab freezing can't lose it, and two tabs starting together can't both win.
//
// Every web entry point must acquire ownership BEFORE the first SQLite open or
// a pre-login wallet mutation (initializeAllDatabases, wipeLocalWalletData,
// factoryResetWallet). In-account writes (password change, settings) are
// reachable only after loadingScreen's initializeAllDatabases succeeded, so a
// non-owning tab never gets there.

export const WEB_DB_TAB_CONFLICT_ERROR = 'dbTabConflictError';

const LOCK_NAME = 'blitzwallet-db-owner';

let ownershipPromise = null;

// Resolves true when this tab owns the databases. Throws
// Error(WEB_DB_TAB_CONFLICT_ERROR) when another tab holds the lock.
export function acquireWebDatabaseOwnership() {
  if (!ownershipPromise) {
    ownershipPromise = new Promise((resolve, reject) => {
      // ponytail: OPFS sync handles need a secure context, which also provides
      // navigator.locks — without locks SQLite fails on its own anyway.
      if (!navigator.locks?.request) {
        resolve(true);
        return;
      }
      navigator.locks
        .request(LOCK_NAME, { ifAvailable: true }, lock => {
          if (!lock) {
            reject(new Error(WEB_DB_TAB_CONFLICT_ERROR));
            return;
          }
          resolve(true);
          return new Promise(() => {}); // hold for the tab's lifetime
        })
        .catch(reject);
    }).catch(err => {
      ownershipPromise = null;
      throw err;
    });
  }
  return ownershipPromise;
}

export function isTabConflictError(err) {
  return err?.message === WEB_DB_TAB_CONFLICT_ERROR;
}
