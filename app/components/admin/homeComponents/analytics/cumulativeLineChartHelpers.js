// Inlines amount-extraction to stay free of native-SDK imports (Jest-safe).
import {
  getDollarsFromTx,
  getSatsFromTx,
} from '../../../../functions/analytics';

/**
 * Builds a cumulative daily total for the current month.
 *
 * @param {object[]} txs - Rows from getMonthlyTransactions (any order)
 * @param {Date} today - Override for testability (default: new Date())
 * @returns {{ timestamp: number, value: number }[]} Days 1..todayDay with timestamps, ascending
 */
export function buildCumulativeData(
  txs,
  today = new Date(),
  currentPrice = 0,
  direction,
  isUSD,
) {
  const todayDay = today.getDate();
  const satsFunction = isUSD ? getDollarsFromTx : getSatsFromTx;

  const byDay = {};
  for (const tx of txs) {
    try {
      const details = JSON.parse(tx.details);
      const date = new Date(details.time);
      const day = date.getDate();
      byDay[day] =
        (byDay[day] || 0) + satsFunction(tx, currentPrice, direction);
    } catch {
      // skip malformed tx
    }
  }

  const result = [];
  let running = 0;
  for (let d = 1; d <= todayDay; d++) {
    running += byDay[d] || 0;
    const timestamp = new Date(
      today.getFullYear(),
      today.getMonth(),
      d,
    ).getTime();
    result.push({
      timestamp,
      value: isUSD ? parseFloat(running.toFixed(2)) : Math.round(running),
    });
  }
  return result;
}
