import sha256Hash from '../hash';
import {
  sparkBalanceUpdateEmitter,
  BALANCE_UPDATE_EVENT_NAME,
  sparkTokenBalanceUpdateEmitter,
  TOKEN_BALANCE_UPDATE_EVENT_NAME,
} from '../../../context-store/webViewContext';
import {
  getSparkBalance,
  selectSparkRuntime,
  getWallet,
  attachWalletListeners,
  isOptimizationInProgress,
} from './index';

/**
 * Live balance subscription for a DERIVED wallet (gift/pool/savings).
 *
 * Does an immediate getSparkBalance read, then reacts to the wallet's real-time
 * balance:update / token-balance:update push events — replacing the old fixed
 * retry-loop pollers. Each event just triggers a fresh getSparkBalance read, so
 * onUpdate always receives the same { balance, tokensObj, didWork } shape the
 * pollers produced (works for both sats and token/USDB predicates).
 *
 * Events are wallet-scoped by mnemonic hash (walletId), so a derived wallet's
 * updates never leak into the main-wallet handlers and vice versa.
 *
 * When `stabilize` is true, sats `balance:update` events are debounced and a
 * decrease is held while the SDK reports an auto-optimization in progress —
 * killing the transient dip→settle flicker on always-mounted balance screens.
 * Default (false) keeps the raw per-event pass-through the predicate consumer
 * (awaitSparkBalance) and existing callers rely on.
 *
 * @param {Object} params
 * @param {string} params.mnemonic - derived wallet mnemonic
 * @param {(result: {balance: any, tokensObj?: object, didWork: boolean}) => void} params.onUpdate
 * @param {boolean} [params.stabilize=false] - debounce + downward-gate sats updates
 * @returns {{ unsubscribe: () => void, ready: Promise<void> }}
 */
export const subscribeToSparkBalance = ({
  mnemonic,
  onUpdate,
  stabilize = false,
}) => {
  const walletHash = sha256Hash(mnemonic);

  let cancelled = false;
  let reading = false;
  let pendingReRead = false;
  let nativeWallet = null;

  // Stabilize-only state. lastPainted tracks the last value handed to onUpdate
  // so the flush can tell an increase from a decrease; flushGen invalidates a
  // slow optimization-check whose flush was superseded by a newer one.
  let lastPainted = null;
  let debounceTimer = null;
  let maxWaitTimer = null;
  let retryTimer = null;
  let flushGen = 0;

  const paint = result => {
    if (cancelled) return;
    if (result?.didWork) lastPainted = Number(result.balance || 0);
    onUpdate(result);
  };
  const applyResult = stabilize ? paint : onUpdate;

  const clearFlushTimers = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (maxWaitTimer) clearTimeout(maxWaitTimer);
    if (retryTimer) clearTimeout(retryTimer);
    debounceTimer = null;
    maxWaitTimer = null;
    retryTimer = null;
  };

  // A held dip must resolve deterministically — the balance read is ground
  // truth EXCEPT mid-optimization, so instead of waiting on a future settle
  // event (which can be lost or never fire in background), re-run the flush
  // ourselves until the optimization clears and the read is trustworthy.
  // ponytail: fixed 10s poll; fine for a mounted settings screen, revisit if
  // this ever drives an always-on view.
  const armRetry = () => {
    if (cancelled) return;
    retryTimer = setTimeout(flushStable, 10000);
  };

  // One gated read after the optimization burst goes quiet. Reading at flush
  // (rather than staging event values) means the read is ground truth — no
  // X→Y→X guard needed — and coalesces the per-event read storm.
  const flushStable = () => {
    clearFlushTimers();
    if (cancelled) return;
    const gen = ++flushGen;
    getSparkBalance(mnemonic)
      .then(result => {
        if (cancelled || gen !== flushGen || !result?.didWork) return;
        const value = Number(result.balance || 0);
        if (lastPainted != null && value === lastPainted) return;
        if (lastPainted != null && value < lastPainted) {
          // A decrease is a real spend OR a transient optimization dip. Paint
          // only once we've CONFIRMED no optimization is running (the read is
          // then trustworthy). If it's still optimizing — or the check itself
          // is unknown (didWork:false / threw) — the dip can't be trusted, so
          // re-arm a bounded retry instead of stranding the stale-high value
          // behind a settle event that may never arrive.
          isOptimizationInProgress({ mnemonic })
            .then(res => {
              if (cancelled || gen !== flushGen) return; // superseded
              if (res?.didWork && !res.isOptimizing) {
                paint(result); // confirmed real spend
              } else {
                armRetry(); // optimizing, or status unknown
              }
            })
            .catch(() => {
              if (!cancelled && gen === flushGen) armRetry();
            });
          return;
        }
        paint(result); // increase (or first paint)
      })
      .catch(() => {});
  };

  const readBalance = async () => {
    if (cancelled) return;
    // Serialize reads so a burst of events can't stack overlapping requests;
    // remember if another read was requested mid-flight and run it once.
    if (reading) {
      pendingReRead = true;
      return;
    }
    reading = true;
    try {
      const result = await getSparkBalance(mnemonic);
      if (!cancelled) applyResult(result);
    } finally {
      reading = false;
      if (pendingReRead && !cancelled) {
        pendingReRead = false;
        readBalance();
      }
    }
  };

  // WebView runtime: events arrive on the shared emitters, tagged with walletId.
  const onBalanceEvent = (_data, walletId) => {
    if (walletId && walletId !== walletHash) return;
    if (stabilize) {
      // Trailing 3s debounce, capped at 10s so a sustained burst still flushes.
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flushStable, 2000);
      if (!maxWaitTimer) maxWaitTimer = setTimeout(flushStable, 5000);
      return;
    }
    readBalance();
  };
  const onTokenEvent = (_tokensObject, walletId) => {
    if (walletId && walletId !== walletHash) return;
    readBalance();
  };

  // Native runtime: events fire directly on the SDK wallet instance. Route the
  // sats event through the same debounce/gate so stabilize mode works on native.
  const nativeBalanceCb = () => onBalanceEvent(null, null);
  const nativeTokenCb = () => readBalance();

  const setup = async () => {
    // Immediate read first — funds may already be present.
    await readBalance();
    if (cancelled) return;

    const runtime = await selectSparkRuntime(mnemonic);
    if (cancelled) return;

    if (runtime === 'webview') {
      const attached = await attachWalletListeners(mnemonic, () => cancelled);
      if (cancelled) return;
      if (!attached) {
        // Subscribe anyway — awaitSparkBalance's timeoutMs fallback read is the
        // last resort if no events ever arrive.
        console.log(
          'Could not attach listeners for derived wallet',
          walletHash,
        );
      }
      sparkBalanceUpdateEmitter.on(BALANCE_UPDATE_EVENT_NAME, onBalanceEvent);
      sparkTokenBalanceUpdateEmitter.on(
        TOKEN_BALANCE_UPDATE_EVENT_NAME,
        onTokenEvent,
      );
    } else {
      nativeWallet = await getWallet(mnemonic);
      if (cancelled || !nativeWallet) return;
      nativeWallet.on('balance:update', nativeBalanceCb);
      nativeWallet.on('token-balance:update', nativeTokenCb);
    }
  };

  const ready = setup();

  const unsubscribe = () => {
    if (cancelled) return;
    cancelled = true;
    clearFlushTimers();
    sparkBalanceUpdateEmitter.removeListener(
      BALANCE_UPDATE_EVENT_NAME,
      onBalanceEvent,
    );
    sparkTokenBalanceUpdateEmitter.removeListener(
      TOKEN_BALANCE_UPDATE_EVENT_NAME,
      onTokenEvent,
    );
    if (nativeWallet) {
      nativeWallet.removeListener?.('balance:update', nativeBalanceCb);
      nativeWallet.removeListener?.('token-balance:update', nativeTokenCb);
    }
  };

  return { unsubscribe, ready };
};

/**
 * One-shot: resolve as soon as predicate(balanceResult) is true (including on the
 * initial read), or fall back to a final getSparkBalance read after timeoutMs.
 * Always cleans up its subscription. Does NOT dispose the SDK wallet — callers
 * still need it to send afterward (see disposeSparkWallet at end of flow).
 *
 * @param {Object} params
 * @param {string} params.mnemonic
 * @param {(result: object) => boolean} params.predicate
 * @param {number} [params.timeoutMs=60000]
 * @param {() => void} [params.onStatus] - optional hook to drive a loading message
 * @returns {Promise<object>} the balance result the flow resolved/fell back to
 */
export const awaitSparkBalance = ({
  mnemonic,
  predicate,
  timeoutMs = 60000,
  onStatus,
}) => {
  return new Promise(resolve => {
    let settled = false;
    let timer = null;
    let lastResult = { didWork: false };

    const finish = result => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
      resolve(result);
    };

    onStatus?.();

    const subscription = subscribeToSparkBalance({
      mnemonic,
      onUpdate: result => {
        lastResult = result;
        if (predicate(result)) finish(result);
      },
    });

    timer = setTimeout(async () => {
      let finalResult = lastResult;
      try {
        const read = await getSparkBalance(mnemonic);
        if (read?.didWork) finalResult = read;
      } catch {}
      finish(finalResult);
    }, timeoutMs);
  });
};
