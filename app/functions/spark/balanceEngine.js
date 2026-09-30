import { shouldHoldBalanceDecrease } from './balanceGate';

// Coalesce a burst of balance:update events into one commit.
const COALESCE_MS = 300;
const MAX_WAIT_MS = 1000;
// Bounded re-check after funds move or a value is held (~45 s in total).
const RECHECK_DELAYS = [1500, 4000, 10000, 30000];

/**
 * Decides the displayed sats balance (the SDK's `available`).
 *
 * Inputs: balance:update snapshots (onEvent), transfer:claimed balances
 * (onClaim), authoritative reads (read/settle) and the sending flag.
 *
 * - Events are coalesced, then applied unless a hold rule applies: a decrease
 *   while a send is in flight (the leaf-lock dip), or a non-send decrease
 *   while `owned` still covers the display (optimization / unsettled leaves).
 * - Nothing is held, skipped or discarded without a bounded re-check: every
 *   hold, every settle request (funds moved) and every send end arms one.
 *   A re-check probes the SDK's optimizing flag first (no read while it
 *   optimizes; an unknown probe reads) and stops once a landed read agrees
 *   with the newest SDK snapshot, or after RECHECK_DELAYS.
 * - A read loses to any commit made after it started (a stale-high read can
 *   never overwrite a newer event) and then reports "not landed".
 * - No read happens while sending except settle({allowDuringSend}) — the
 *   send's own settle read.
 */
export function createBalanceEngine({
  getDisplayed,
  commit,
  read: readBalance,
  probeOptimizing,
  isSending,
  isActive,
}) {
  let disposed = false;
  let version = 0; // bumps on every commit and on invalidate()
  let latest = null; // newest SDK snapshot {available, owned}
  let staged = false; // latest not applied yet
  let trailing = null;
  let deadline = null;
  let recheck = null;
  let step = 0;
  let inFlight = null;
  let inFlightIsSendSettle = false;
  let rerun = false;
  // A settle request (funds moved) is satisfied only by a read that started
  // after it and landed.
  let wanted = 0;
  let satisfied = 0;
  let readsStarted = 0;
  let readsAtSendStart = 0;

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

  const converged = () =>
    satisfied >= wanted &&
    !staged &&
    (latest === null || latest.available === getDisplayed());

  const shouldHold = (snapshot, displayed) =>
    snapshot.available < displayed &&
    (isSending() ||
      shouldHoldBalanceDecrease({
        nextAvailable: snapshot.available,
        nextOwned: snapshot.owned,
        displayed,
        isSending: false,
      }));

  const flush = () => {
    clearCoalesce();
    if (disposed || !staged) return;
    staged = false;
    const displayed = getDisplayed();
    if (latest.available === displayed) return;
    if (shouldHold(latest, displayed)) {
      arm(false);
      return;
    }
    if (mayBeOptimizing(latest.available, displayed)) {
      confirmNotOptimizing(latest);
      return;
    }
    doCommit(latest.available, { source: 'event' });
  };

  // A value that may be an optimization artifact: outside a send, a decrease
  // (mid-optimization the SDK can drop the swapped leaves from `owned` too, so
  // the owned rule cannot tell it from a real spend), or a rise that is still
  // below `owned` (the swap's replacement leaves have not all landed).
  const mayBeOptimizing = (value, displayed) =>
    !isSending() &&
    (value < displayed || (latest !== null && value < latest.owned));

  // Lands the snapshot only once the SDK says it is not optimizing (unknown
  // probe: land it). A newer event or commit made while the probe ran
  // decides instead.
  const confirmNotOptimizing = snapshot => {
    const startVersion = version;
    Promise.resolve()
      .then(probeOptimizing)
      .catch(() => null)
      .then(optimizing => {
        if (disposed || staged || latest !== snapshot) return;
        if (version !== startVersion) return;
        if (optimizing === true) {
          arm(false);
          return;
        }
        doCommit(snapshot.available, { source: 'event' });
      });
  };

  // sendSettle: the send's own settle read (started while sending). Its lower
  // value is the spend itself, so it never waits on an optimization probe.
  const read = ({ sendSettle = false } = {}) => {
    if (disposed) return Promise.resolve(false);
    if (inFlight) {
      rerun = true;
      return inFlight;
    }
    const run = (async () => {
      let landed = false;
      do {
        rerun = false;
        const startVersion = version;
        const startWanted = wanted;
        readsStarted += 1;
        let result = null;
        try {
          result = await readBalance();
        } catch {}
        // invalidate()/dispose() while in flight: this run is void.
        if (disposed || inFlight !== run) return false;
        const value = Number(result?.balance);
        // Mid-optimization a read only sees the leaves not in the swap; such a
        // value lands only if the SDK is not optimizing.
        let optimizingDip = false;
        if (
          !sendSettle &&
          Number.isFinite(value) &&
          mayBeOptimizing(value, getDisplayed())
        ) {
          try {
            optimizingDip = (await probeOptimizing()) === true;
          } catch {}
          if (disposed || inFlight !== run) return false;
        }
        landed =
          !optimizingDip &&
          version === startVersion &&
          isActive() &&
          !!result?.didWork &&
          Number.isFinite(value);
        if (landed) {
          satisfied = Math.max(satisfied, startWanted);
          doCommit(value, { source: 'read', tokens: result.tokensObj });
        }
      } while (rerun);
      return landed;
    })();
    inFlight = run;
    inFlightIsSendSettle = sendSettle;
    run.finally(() => {
      if (inFlight === run) inFlight = null;
    });
    return run;
  };

  const runRecheck = async () => {
    recheck = null;
    // Background and sends re-arm on their own edge (foreground settle,
    // onSendingChange(false)), so a re-check never waits them out.
    if (disposed || !isActive() || isSending()) return;
    if (converged()) {
      step = 0;
      return;
    }
    step += 1;
    let optimizing = null;
    try {
      optimizing = await probeOptimizing();
    } catch {}
    if (disposed) return;
    // Only a confirmed "optimizing" skips the read; unknown reads.
    if (optimizing !== true && !isSending()) await read({});
    if (disposed || recheck) return;
    if (converged() || step >= RECHECK_DELAYS.length) {
      step = 0;
      return;
    }
    recheck = setTimeout(runRecheck, RECHECK_DELAYS[step]);
  };

  // restart=true starts a fresh budget (funds moved); otherwise an armed
  // sequence keeps its schedule.
  const arm = restart => {
    if (disposed) return;
    if (recheck) {
      if (!restart) return;
      clearTimeout(recheck);
    }
    if (restart) step = 0;
    recheck = setTimeout(runRecheck, RECHECK_DELAYS[step]);
  };

  return {
    version: () => version,

    onEvent(snapshot) {
      if (disposed) return;
      const available = Number(snapshot?.available);
      if (!Number.isFinite(available)) return;
      latest = { available, owned: Number(snapshot?.owned) };
      staged = true;
      clearTimeout(trailing);
      trailing = setTimeout(flush, COALESCE_MS);
      if (!deadline) deadline = setTimeout(flush, MAX_WAIT_MS);
    },

    flush,

    // transfer:claimed carries a fresh post-claim read. While the SDK
    // optimizes, balance:update reports a suppressed `available` that the
    // owned rule keeps off screen, so the claim number lands instead: upward
    // only, only while optimizing and not sending (a send cancels
    // optimization, so a stale-high claim can never mask a spend), and it
    // loses to anything committed while the probe ran.
    onClaim(claimedBalance) {
      if (disposed) return;
      flush();
      const claimed = Number(claimedBalance);
      if (!Number.isFinite(claimed) || claimed <= getDisplayed()) return;
      const startVersion = version;
      Promise.resolve(probeOptimizing())
        .then(optimizing => {
          if (disposed || optimizing !== true || isSending()) return;
          if (version !== startVersion || claimed <= getDisplayed()) return;
          doCommit(claimed, { source: 'claim' });
        })
        .catch(() => {});
    },

    read,

    // Funds moved or events may have been missed: read now (unless a send is
    // in flight and this is not its own settle read) and converge.
    settle({ allowDuringSend = false } = {}) {
      if (disposed) return Promise.resolve(false);
      wanted += 1;
      arm(true);
      if (isSending() && !allowDuringSend) return Promise.resolve(false);
      return read({ sendSettle: isSending() });
    },

    // Resolves once a send's held values were re-applied (callers release
    // anything else they held for the send at the same moment).
    onSendingChange(sending) {
      if (disposed) return Promise.resolve();
      if (sending) {
        readsAtSendStart = readsStarted;
        return Promise.resolve();
      }
      // A send moved funds. Its own settle read (started during the send,
      // after the send op returned) covers it; otherwise ask for one read.
      if (readsStarted === readsAtSendStart) wanted += 1;
      // Re-apply what was held while sending, then converge. If the send's
      // own settle read is still in flight, let it land first: it carries the
      // sats and token sides together (no half-applied swap on screen).
      const release = () => {
        if (disposed) return;
        if (latest) staged = true;
        flush();
        arm(true);
      };
      if (inFlight && inFlightIsSendSettle) return inFlight.finally(release);
      release();
      return Promise.resolve();
    },

    // Background / reconnect: in-flight reads can no longer land, and no
    // timer runs until the next settle.
    invalidate() {
      version += 1;
      inFlight = null;
      rerun = false;
      clearTimeout(recheck);
      recheck = null;
      step = 0;
    },

    dispose() {
      disposed = true;
      clearCoalesce();
      clearTimeout(recheck);
      recheck = null;
      inFlight = null;
    },
  };
}
