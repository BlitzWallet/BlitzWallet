// Coalesce a burst of balance:update events into one commit.
const COALESCE_MS = 300;
const MAX_WAIT_MS = 1000;
// A settle read that failed (timeout, bridge error) is retried; one that lost
// to a newer event is not (the event is newer).
const RETRY_MS = [2000, 8000, 30000];

/**
 * Decides the displayed sats balance.
 *
 * The SDK's in-memory `available`
 * plus the leaves locked for optimization (a swap returns the same amount),
 * without the leaves being spent. An optimization never dips it; a real spend
 * always does, so there are no hold rules.
 *
 * - balance:update events are coalesced, then the newest value commits.
 * - read() (getBalance: syncs leaves with the operators, then reports the
 *   same in-memory value) repairs events missed while backgrounded,
 *   disconnected or sending, and carries the token balances. Events and reads
 *   describe one state, so the newest arrival wins: a read loses to any event
 *   that arrived while it was in flight. A failed settle read is retried a
 *   bounded number of times.
 * - While a send is in flight nothing lands (its leaf locks dip the value),
 *   except the send's own settle read; the newest held event lands at the end.
 */
export function createBalanceEngine({
  getDisplayed,
  commit,
  read: readBalance,
  isSending,
  isActive,
}) {
  let disposed = false;
  let version = 0; // bumps on every commit
  let arrivals = 0; // bumps on every event and landed read
  let staged = null; // newest event value not committed yet
  let trailing = null;
  let deadline = null;
  let inFlight = null;
  let rerun = false;
  let readFailed = false;
  let retry = null;

  const clearCoalesce = () => {
    clearTimeout(trailing);
    clearTimeout(deadline);
    trailing = null;
    deadline = null;
  };

  const doCommit = (value, info) => {
    version += 1;
    commit(value, info);
  };

  const flush = () => {
    clearCoalesce();
    if (disposed || staged === null || isSending()) return;
    const value = staged;
    staged = null;
    if (value !== getDisplayed()) doCommit(value, { source: 'event' });
  };

  const read = () => {
    if (disposed) return Promise.resolve(false);
    if (inFlight) {
      rerun = true;
      return inFlight;
    }
    const run = (async () => {
      let landed = false;
      do {
        rerun = false;
        const startArrivals = arrivals;
        let result = null;
        try {
          result = await readBalance();
        } catch {}
        // invalidate()/dispose() while in flight: this run is void.
        if (disposed || inFlight !== run) return false;
        const value = Number(result?.balance);
        readFailed = !result?.didWork || !Number.isFinite(value);
        landed =
          arrivals === startArrivals &&
          isActive() &&
          !!result?.didWork &&
          Number.isFinite(value);
        if (landed) {
          arrivals += 1;
          staged = null; // older than this read
          clearCoalesce();
          doCommit(value, { source: 'read', tokens: result.tokensObj });
        }
      } while (rerun);
      return landed;
    })();
    inFlight = run;
    run.finally(() => {
      if (inFlight === run) inFlight = null;
    });
    return run;
  };

  const cancelRetry = () => {
    clearTimeout(retry);
    retry = null;
  };

  const settleAttempt = n =>
    read().then(landed => {
      if (!landed && readFailed && !disposed && n < RETRY_MS.length) {
        retry = setTimeout(() => {
          retry = null;
          if (!disposed && !isSending()) settleAttempt(n + 1);
        }, RETRY_MS[n]);
      }
      return landed;
    });

  return {
    version: () => version,

    onEvent(snapshot) {
      if (disposed) return;
      const value =
        Number(snapshot?.available) + Number(snapshot?.optimizationLocked ?? 0);
      if (!Number.isFinite(value)) return;
      arrivals += 1;
      staged = value;
      clearTimeout(trailing);
      trailing = setTimeout(flush, COALESCE_MS);
      if (!deadline) deadline = setTimeout(flush, MAX_WAIT_MS);
    },

    read,

    // Funds moved or events may have been missed: read now. While sending,
    // only the send's own settle read runs; the send end covers the rest.
    settle({ allowDuringSend = false } = {}) {
      if (disposed || (isSending() && !allowDuringSend)) {
        return Promise.resolve(false);
      }
      cancelRetry();
      return settleAttempt(0);
    },

    // Resolves once what the send held has landed. An in-flight settle read
    // lands first, so sats and tokens reach the screen together.
    onSendingChange(sending) {
      if (disposed || sending) return Promise.resolve();
      return Promise.resolve(inFlight).then(flush);
    },

    // Background / reconnect: an in-flight read may never settle; void it so
    // the next settle starts fresh.
    invalidate() {
      cancelRetry();
      inFlight = null;
      rerun = false;
    },

    dispose() {
      disposed = true;
      clearCoalesce();
      cancelRetry();
      inFlight = null;
    },
  };
}
