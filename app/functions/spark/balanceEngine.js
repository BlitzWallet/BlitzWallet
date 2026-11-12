// Trigger -> read engine. Breez events (synced / payment* / claimedDeposits)
// carry no balance, so each one only triggers a coalesced getInfo read; the
// newest read wins. While a send is in flight nothing lands except the send's
// own settle read, and follow-up reads after a send catch a late-landing change.
const COALESCE_MS = 300;
const MAX_WAIT_MS = 1000;
const RETRY_MS = [2000, 8000, 30000];
const ZERO_RECHECK_MS = 8000;
const FOLLOW_UP_MS = [1500, 4000, 10000];

export function createBalanceEngine({
  getDisplayed,
  commit,
  read,
  isSending,
  isActive,
  syncIntervalSecs = 60,
  onConnectivity = () => {},
}) {
  let disposed = false;
  let version = 0;
  let arrivals = 0;
  let trailing = null;
  let deadline = null;
  let inFlight = null;
  let rerun = false;
  let readFailed = false;
  let retry = null;
  let lastVerifiedAt = 0;
  let sessionVerified = false;
  let expectChange = null;
  let followUpTimer = null;

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

  const trigger = () => {
    if (disposed) return;
    arrivals += 1;
    clearTimeout(trailing);
    trailing = setTimeout(flush, COALESCE_MS);
    if (!deadline) deadline = setTimeout(flush, MAX_WAIT_MS);
  };

  const readOnce = async () => {
    if (disposed) return { landed: false };
    if (inFlight) {
      rerun = true;
      return inFlight;
    }
    const run = (async () => {
      let landed = false;
      const runStart = Date.now();
      do {
        rerun = false;
        const start = arrivals;
        let result = null;
        try {
          result = await read();
        } catch {}
        if (disposed || inFlight !== run) return { landed: false };
        const value = Number(result?.balance);
        readFailed = !result?.didWork || !Number.isFinite(value);
        if (!readFailed && isActive()) {
          if (value === 0 && getDisplayed() > 0 && !sessionVerified) {
            readFailed = true;
            retry = setTimeout(() => {
              retry = null;
              if (!disposed && !isSending()) readOnce();
            }, ZERO_RECHECK_MS);
          } else {
            landed = arrivals === start;
            if (!landed) rerun = true;
            // A burst faster than one read must not freeze the display: after
            // MAX_WAIT_MS commit the newest successful read and keep re-reading.
            if (landed || Date.now() - runStart >= MAX_WAIT_MS) {
              doCommit(value, {
                source: 'read',
                tokens: result.tokensObj,
                verified: sessionVerified,
                lastVerifiedAt,
              });
            }
          }
        }
      } while (rerun);
      return { landed };
    })();
    inFlight = run;
    run.finally(() => {
      if (inFlight === run) inFlight = null;
    });
    return run;
  };

  const flush = () => {
    clearCoalesce();
    if (disposed || isSending()) return;
    readOnce();
  };

  const scheduleFollowUp = () => {
    if (!expectChange || disposed) return;
    const { from, tries } = expectChange;
    if (getDisplayed() !== from || tries >= FOLLOW_UP_MS.length) {
      expectChange = null;
      return;
    }
    followUpTimer = setTimeout(async () => {
      followUpTimer = null;
      if (disposed || isSending()) return;
      expectChange = { from, tries: tries + 1 };
      await readOnce();
      if (getDisplayed() === from) scheduleFollowUp();
    }, FOLLOW_UP_MS[tries]);
  };

  const settle = async ({ allowDuringSend = false } = {}) => {
    if (disposed || (isSending() && !allowDuringSend)) return false;
    clearTimeout(retry);
    retry = null;
    let n = 0;
    let landed = false;
    do {
      const out = await readOnce();
      landed = out.landed;
      if (!landed && readFailed && n < RETRY_MS.length) {
        await new Promise(res => {
          retry = setTimeout(res, RETRY_MS[n]);
        });
        n += 1;
      } else break;
    } while (!disposed && !isSending());
    return landed;
  };

  return {
    version: () => version,
    lastVerifiedAt: () => lastVerifiedAt || null,

    onEvent(event) {
      if (disposed || !event) return;
      switch (event.type) {
        case 'synced':
        case 'paymentSucceeded':
        case 'claimedDeposits':
          lastVerifiedAt = Date.now();
          sessionVerified = true;
          onConnectivity('online');
          trigger();
          break;
        case 'paymentPending':
        case 'paymentFailed':
        case 'recoverableFunds':
          trigger();
          break;
        case 'autoOptimization':
        case 'unilateralExitStateChanged':
        case 'unclaimedDeposits':
        case 'newDeposits':
          break;
        default:
          break;
      }
    },

    read: readOnce,
    trigger,
    settle,

    onSendingChange(sending) {
      if (disposed || sending) return Promise.resolve();
      return Promise.resolve(inFlight).then(async () => {
        expectChange = { from: getDisplayed(), tries: 0 };
        await settle();
        scheduleFollowUp();
      });
    },

    invalidate() {
      clearTimeout(retry);
      clearTimeout(followUpTimer);
      retry = null;
      followUpTimer = null;
      inFlight = null;
      rerun = false;
      expectChange = null;
    },

    dispose() {
      disposed = true;
      clearCoalesce();
      clearTimeout(retry);
      clearTimeout(followUpTimer);
      retry = null;
      followUpTimer = null;
      inFlight = null;
    },
  };
}
