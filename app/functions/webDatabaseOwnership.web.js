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
// reloads — releasing the lock — and the new tab waits for that lock. Takeovers
// carry an ordering stamp (boot sequence, timestamp, nonce) so two tabs booting
// in the same broadcast window resolve to exactly one winner instead of
// displacing each other into a mutual TabInUse stalemate. A
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
// Origin-shared monotonic boot counter. Date.now() has 1ms resolution, so two
// tabs booting in the same millisecond compare as tied; the counter records
// the causal boot order instead (a later boot reads the earlier boot's write).
// Falls back to a process-global counter (shared by tabs in test harnesses;
// per-tab in browsers, where it harmlessly ties and timestamp+nonce decide).
const BOOT_SEQ_KEY = 'blitzwallet-tab-boot-seq';

function nextBootSequence() {
  try {
    const storage = window.localStorage;
    const prev = parseInt(storage.getItem(BOOT_SEQ_KEY) || '0', 10) || 0;
    const next = prev + 1;
    storage.setItem(BOOT_SEQ_KEY, String(next));
    return next;
  } catch {}
  try {
    globalThis.__blitzwalletBootSeq =
      (globalThis.__blitzwalletBootSeq || 0) + 1;
    return globalThis.__blitzwalletBootSeq;
  } catch {
    return 0;
  }
}
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
  // point was posted by a tab that booted after us — except in the
  // simultaneous-boot window where both tabs broadcast at ~the same time. A
  // symmetric unconditional yield makes both tabs displace each other into a
  // mutual TabInUse stalemate, so takeovers carry an ordering stamp (boot
  // sequence, timestamp, nonce tie-break) and a tab yields only to a strictly
  // newer sender, guaranteeing exactly one winner.
  const myBootTime = Date.now();
  const myBootSequence = nextBootSequence();
  const myNonce = Math.random();
  if (channel) {
    channel.onmessage = event => {
      const data = event?.data;
      // Legacy sender (pre-ordering builds): no stamp to compare, and the
      // sender booted after us, so it is newer — yield.
      if (data === TAKEOVER_MESSAGE) {
        yieldToNewerTab();
        return;
      }
      if (data && typeof data === 'object' && data.type === TAKEOVER_MESSAGE) {
        if (typeof data.seq === 'number' && data.seq !== myBootSequence) {
          if (data.seq > myBootSequence) yieldToNewerTab();
        } else if (
          typeof data.at !== 'number' ||
          data.at > myBootTime ||
          (data.at === myBootTime && data.nonce > myNonce)
        ) {
          yieldToNewerTab();
        }
        // Else: the sender is older (or tied in our favour) — ignore so only
        // one of two simultaneously booting tabs yields.
      }
    };
  }
  channel?.postMessage({
    type: TAKEOVER_MESSAGE,
    at: myBootTime,
    seq: myBootSequence,
    nonce: myNonce,
  });

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
