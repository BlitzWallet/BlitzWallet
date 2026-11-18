import { getSparkBalance } from './index';

/**
 * Reads the balance with a hard timeout. getSparkBalance can hang if the
 * underlying request never settles. An unsettled read would park the balance
 * lane forever, so we race the read against a timer that resolves to a benign
 * {didWork:false}.
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
