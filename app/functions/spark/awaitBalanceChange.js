import { AppState } from 'react-native';
import { getSparkBalance } from './index';
import { acquire } from './walletRuntime';

// Breez events that can change a balance. They carry no balance themselves, so
// each one just triggers a fresh getSparkBalance read.
const BALANCE_EVENTS = new Set([
  'synced',
  'paymentSucceeded',
  'paymentPending',
  'paymentFailed',
  'claimedDeposits',
]);

/**
 * Live balance subscription for a DERIVED wallet (gift/pool/savings).
 *
 * Does an immediate getSparkBalance read, then re-reads on the wallet's Breez
 * payment / sync / deposit events, so onUpdate always receives the same
 * { balance, tokensObj, didWork } shape the pollers produced (works for both
 * sats and token/USDB predicates). Events are per wallet handle, so a derived
 * wallet never leaks into the main-wallet handlers. Breez keeps swap-reserved
 * leaves in the balance, so there is no optimization dip to stabilize.
 *
 * @param {Object} params
 * @param {string} params.mnemonic - derived wallet mnemonic
 * @param {(result: {balance: any, tokensObj?: object, didWork: boolean}) => void} params.onUpdate
 * @returns {{ unsubscribe: () => void, ready: Promise<void> }}
 */
export const subscribeToSparkBalance = ({ mnemonic, onUpdate }) => {
  let cancelled = false;
  let reading = false;
  let pendingReRead = false;
  let handle = null;
  let offEvents = null;
  let appStateSub = null;

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

  const setup = async () => {
    // Immediate read first — funds may already be present.
    await readBalance();
    if (cancelled) return;

    try {
      // Borrow the handle the flow opened (server mode for derived wallets);
      // falls back to opening client mode when none is live.
      handle = await acquire(mnemonic, { mode: 'client', borrow: true });
    } catch (err) {
      // awaitSparkBalance's timeoutMs fallback read is the last resort.
      console.log('Could not open derived wallet for balance events', err);
      return;
    }
    if (cancelled) {
      handle = null;
      return;
    }
    offEvents = handle.on(event => {
      if (BALANCE_EVENTS.has(event?.type)) readBalance();
    });

    // Events are missed while backgrounded: re-read on foreground.
    appStateSub = AppState.addEventListener('change', state => {
      if (!cancelled && state === 'active') readBalance();
    });

    // Pull operator state once, then read: anything that landed between the
    // first read and the listener attach (e.g. a post-connect claim) shows up.
    await handle.sync();
    readBalance();
  };

  const ready = setup();

  const unsubscribe = () => {
    if (cancelled) return;
    cancelled = true;
    appStateSub?.remove();
    offEvents?.();
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
