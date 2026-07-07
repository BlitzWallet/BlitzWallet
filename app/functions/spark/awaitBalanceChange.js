import sha256Hash from '../hash';
import {
  OPERATION_TYPES,
  sendWebViewRequestGlobal,
  sparkBalanceUpdateEmitter,
  BALANCE_UPDATE_EVENT_NAME,
  sparkTokenBalanceUpdateEmitter,
  TOKEN_BALANCE_UPDATE_EVENT_NAME,
} from '../../../context-store/webViewContext';
import { getSparkBalance, selectSparkRuntime, getWallet } from './index';

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
 * @param {Object} params
 * @param {string} params.mnemonic - derived wallet mnemonic
 * @param {(result: {balance: any, tokensObj?: object, didWork: boolean}) => void} params.onUpdate
 * @returns {{ unsubscribe: () => void, ready: Promise<void> }}
 */
export const subscribeToSparkBalance = ({ mnemonic, onUpdate }) => {
  const walletHash = sha256Hash(mnemonic);

  let cancelled = false;
  let reading = false;
  let pendingReRead = false;
  let nativeWallet = null;

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
      if (!cancelled) onUpdate(result);
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
    readBalance();
  };
  const onTokenEvent = (_tokensObject, walletId) => {
    if (walletId && walletId !== walletHash) return;
    readBalance();
  };

  // Native runtime: events fire directly on the SDK wallet instance.
  const nativeBalanceCb = () => readBalance();
  const nativeTokenCb = () => readBalance();

  const setup = async () => {
    // Immediate read first — funds may already be present.
    await readBalance();
    if (cancelled) return;

    const runtime = await selectSparkRuntime(mnemonic);
    if (cancelled) return;

    if (runtime === 'webview') {
      await sendWebViewRequestGlobal(OPERATION_TYPES.addListeners, {
        mnemonic,
      });
      if (cancelled) return;
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
