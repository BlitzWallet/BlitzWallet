/* eslint-env jest */
// ---------------------------------------------------------------------------
// Locks the analytics derivation split (context-store/analyticsContext.js
// optimization). The heavy analytics-only math moved out of the always-mounted
// AnalyticsNumbersProvider into pure helpers so it only runs inside the
// analytics stack. These goldens prove the split is backwards compatible:
// deriveAnalytics() reproduces the exact totals/counts the monolithic provider
// produced, and computeSpentTotal() reproduces the one value still needed
// globally by the budget hooks.
// ---------------------------------------------------------------------------

import {
  deriveAnalytics,
  computeSpentTotal,
} from '../../../app/functions/analytics/deriveAnalytics';

const USDB =
  'btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87';
// price so that satsToDollars(sats, PRICE) === sats/1000  ($100k/BTC)
const PRICE = 1000;
const now = Date.now();

const tx = details => ({ details: JSON.stringify({ time: now, ...details }) });

const datasets = {
  // INCOMING BTC: 1000 + 500 = 1500 sats, 2 txs
  incomingBTC: [
    tx({ amount: 1000, isLRC20Payment: false }),
    tx({ amount: 500, isLRC20Payment: false }),
  ],
  // OUTGOING BTC: 200 + fee 10 = 210 sats, 1 tx
  outgoingBTC: [tx({ amount: 200, fee: 10, isLRC20Payment: false })],
  // INCOMING USD: 5_000_000 microdollars => $5.00, 1 tx
  incomingUSD: [tx({ LRC20Token: USDB, amount: 5_000_000 })],
  // OUTGOING USD: $2.00 + fee(100 sats => $0.10) = $2.10, 1 tx
  outgoingUSD: [tx({ LRC20Token: USDB, amount: 2_000_000, fee: 100 })],
};

describe('deriveAnalytics', () => {
  const derived = deriveAnalytics(datasets, PRICE);

  test('reproduces the BTC + USD totals of the old provider', () => {
    expect(derived.incomeTotalBTC).toBe(1500);
    expect(derived.spentTotalBTC).toBe(210);
    expect(derived.incomeTotalUSD).toBe(5);
    expect(derived.spentTotalUSD).toBe(2.1);
  });

  test('reproduces the four tx counts', () => {
    expect(derived.incomeTxCountBTC).toBe(2);
    expect(derived.spentTxCountBTC).toBe(1);
    expect(derived.incomeTxCountUSD).toBe(1);
    expect(derived.spentTxCountUSD).toBe(1);
  });

  test('builds the four cumulative arrays ending at the period total', () => {
    // running sum fills forward to month end, so last point == full total
    const last = arr => arr[arr.length - 1].value;
    expect(last(derived.cumulativeIncomeDataBTC)).toBe(1500);
    expect(last(derived.cumulativeSpentDataBTC)).toBe(210);
    expect(last(derived.cumulativeIncomeDataUSD)).toBe(5);
    expect(last(derived.cumulativeSpentDataUSD)).toBe(2.1);
  });

  test('does not expose spentTotal (owned by the global provider)', () => {
    expect(derived.spentTotal).toBeUndefined();
  });
});

describe('computeSpentTotal', () => {
  test('reproduces round(spentBTC + dollarsToSats(spentUSD)) of the old provider', () => {
    // 210 sats + $2.10 -> 2100 sats = 2310
    expect(
      computeSpentTotal(datasets.outgoingBTC, datasets.outgoingUSD, PRICE),
    ).toBe(2310);
  });

  test('empty datasets total to 0', () => {
    expect(computeSpentTotal([], [], PRICE)).toBe(0);
  });
});
