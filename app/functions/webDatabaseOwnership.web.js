// Origin-wide single-tab ownership for the wallet on web.
//
// expo-sqlite's web backend (wa-sqlite + AccessHandlePoolVFS) acquires
// exclusive synchronous OPFS handles per origin. A second tab that opens the
// same databases fails with NoModificationAllowedError, and the installed
// worker sets `_sqlite3` before VFS creation, so a failed open poisons the
// worker ("Invalid VFS state" on every retry until reload). Seed storage
// (legacy migration, onboarding, wipes) is also shared by every tab, so two
// tabs writing it at once can overwrite a wallet's only encrypted seed.
//
// Mechanism: an exclusive Web Lock held for the tab's lifetime. The browser
// releases it when the tab closes, reloads or crashes, and two tabs starting
// together can't both win. The NEWEST tab wins: it broadcasts a takeover, the
// owner marks itself displaced (sessionStorage, survives its own reload) and
// reloads — releasing the lock — and the new tab waits for that lock. A
// displaced tab boots into the TabInUse screen and never claims until the user
// taps "Use here". Because the new tab only runs once the old page is gone, the
// two tabs never execute wallet code at the same time.
//
// App.tsx acquires ownership at the top of initWallet on web, BEFORE any
// storage migration or routing. Later callers (initializeAllDatabases,
// wipeLocalWalletData, factoryResetWallet) reuse the same memoized promise.

export const WEB_DB_TAB_CONFLICT_ERROR = 'dbTabConflictError';

const LOCK_NAME = 'blitzwallet-db-owner';
const CHANNEL_NAME = 'blitzwallet-tab-owner';
const TAKEOVER_MESSAGE = 'takeover';
const DISPLACED_KEY = 'blitzwallet-tab-displaced';
// A frozen background tab can't receive the takeover but still holds the
// lock. Stealing it would leave that tab's worker holding the OPFS handles, so
// give up and show TabInUse instead.
const TAKEOVER_TIMEOUT_MS = 3000;

// Memoized including rejection: an automatic re-claim would broadcast again and
// could displace the real owner while this tab already shows TabInUse. Retry
// is takeOverFromOtherTab, which reloads.
let ownershipPromise = null;

export function isTabDisplaced() {
  try {
    return window.sessionStorage.getItem(DISPLACED_KEY) === '1';
  } catch {
    return false;
  }
}

function yieldToNewerTab() {
  try {
    window.sessionStorage.setItem(DISPLACED_KEY, '1');
  } catch {}
  window.location.reload();
}

// "Use here" on the TabInUse screen: reload as a normal tab, which takes over.
export function takeOverFromOtherTab() {
  try {
    window.sessionStorage.removeItem(DISPLACED_KEY);
  } catch {}
  window.location.reload();
}

function claimOwnership() {
  if (isTabDisplaced()) {
    return Promise.reject(new Error(WEB_DB_TAB_CONFLICT_ERROR));
  }
  // ponytail: OPFS sync handles need a secure context, which also provides
  // navigator.locks — without locks SQLite fails on its own anyway.
  if (!navigator.locks?.request) return Promise.resolve(true);

  const channel =
    typeof window.BroadcastChannel === 'function'
      ? new window.BroadcastChannel(CHANNEL_NAME)
      : null;
  // Install the listener BEFORE broadcasting or requesting the lock. Two tabs
  // booting together both broadcast; the winner's grant callback runs after
  // the loser's broadcast was already posted, so a listener installed in the
  // grant callback misses the wakeup and the loser times out into TabInUse.
  // Install + broadcast is synchronous, so any takeover received after this
  // point was posted by a tab that booted after us — yield even while queued.
  if (channel) {
    channel.onmessage = event => {
      if (event.data === TAKEOVER_MESSAGE) yieldToNewerTab();
    };
  }
  channel?.postMessage(TAKEOVER_MESSAGE);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TAKEOVER_TIMEOUT_MS);

  return new Promise((resolve, reject) => {
    navigator.locks
      .request(LOCK_NAME, { signal: controller.signal }, () => {
        clearTimeout(timer);
        resolve(true);
        return new Promise(() => {}); // hold for the tab's lifetime
      })
      .catch(() => {
        clearTimeout(timer);
        channel?.close();
        reject(new Error(WEB_DB_TAB_CONFLICT_ERROR));
      });
  });
}

// Resolves true when this tab owns the wallet. Rejects with
// Error(WEB_DB_TAB_CONFLICT_ERROR) when this tab is displaced or the owner
// never let go.
export function acquireWebDatabaseOwnership() {
  if (!ownershipPromise) ownershipPromise = claimOwnership();
  return ownershipPromise;
}

export function isTabConflictError(err) {
  return err?.message === WEB_DB_TAB_CONFLICT_ERROR;
}
