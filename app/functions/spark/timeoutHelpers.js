import {
  getSparkBalance,
  getSparkLeaves,
  getSparkExitNodesForLeaves,
} from './index';

/**
 * Reads the balance with a hard timeout. getSparkBalance can hang indefinitely
 * when the underlying WebView request's timeout is neutered (it returns early
 * without settling while the app is backgrounded). An unsettled read parks the
 * supervisor's await forever and wedges the whole balance lane, so we race the
 * read against a timer that resolves to a benign {didWork:false}.
 * @param {string} mnemonic
 * @param {number} timeoutMs
 * @returns {Promise<{didWork: boolean, balance?: number, tokensObj?: object}>}
 */
export const getBalanceWithTimeout = async (mnemonic, timeoutMs = 15000) => {
  let timer = null;
  console.log('getting balance with timeout');
  try {
    return await Promise.race([
      getSparkBalance(mnemonic),
      new Promise(resolve => {
        timer = setTimeout(() => resolve({ didWork: false }), timeoutMs);
      }),
    ]);
  } catch (err) {
    console.log('err', err);
    return { didWork: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Reads the wallet leaves with a hard timeout, mirroring getBalanceWithTimeout.
 * getSparkLeaves can hang if the underlying request never settles (e.g. while
 * backgrounded), so we race it against a timer that resolves to null. A null
 * result means "no snapshot this time" and the caller leaves the store as-is.
 * @param {string} mnemonic
 * @param {boolean} isBalanceCheck coordinator-only (fast) vs full cross-operator
 * @param {number} timeoutMs
 * @returns {Promise<Array<object>|null>}
 */
export const getSparkLeavesWithTimeout = async (
  mnemonic,
  isBalanceCheck = true,
  timeoutMs = 15000,
) => {
  let timer = null;
  try {
    return await Promise.race([
      getSparkLeaves(mnemonic, isBalanceCheck),
      new Promise(resolve => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch (err) {
    console.log('getSparkLeavesWithTimeout err', err);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Fetches a batch of leaves' exit-node ancestors with a hard timeout, mirroring
 * getSparkLeavesWithTimeout. A hung operator query can't wedge the backfill loop:
 * on timeout we resolve to {} (no leaf marked complete), leaving those leaves
 * pending for a later pass.
 * @param {string} mnemonic
 * @param {Array<object>} leaves batch of raw leaves to fetch ancestors for
 * @param {number} timeoutMs
 * @returns {Promise<Object<string, object[]>>} per-leaf ancestor map
 */
export const getSparkExitNodesForLeavesWithTimeout = async (
  mnemonic,
  leaves,
  timeoutMs = 20000,
) => {
  let timer = null;
  try {
    return await Promise.race([
      getSparkExitNodesForLeaves(mnemonic, leaves),
      new Promise(resolve => {
        timer = setTimeout(() => resolve({}), timeoutMs);
      }),
    ]);
  } catch (err) {
    console.log('getSparkExitNodesForLeavesWithTimeout err', err);
    return {};
  } finally {
    if (timer) clearTimeout(timer);
  }
};
