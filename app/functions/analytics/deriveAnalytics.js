// Pure analytics derivation, extracted from AnalyticsNumbersProvider so the
// heavy work only runs inside the analytics stack (AnalyticsArraysProvider).
// Logic is identical to the old inline provider computation.
import { getSatsFromTx, getDollarsFromTx } from './index';
import { buildCumulativeData } from '../../components/admin/homeComponents/analytics/cumulativeLineChartHelpers';
import { convertToDecimals, dollarsToSats } from '../spark/swapAmountUtils';

function sumSats(txs, priceAInB, direction) {
  return txs.reduce((sum, tx) => {
    try {
      return sum + getSatsFromTx(tx, priceAInB, direction);
    } catch {
      return sum;
    }
  }, 0);
}

function sumDollars(txs, priceAInB, direction) {
  return convertToDecimals(
    txs.reduce((sum, tx) => {
      try {
        return sum + getDollarsFromTx(tx, priceAInB, direction);
      } catch {
        return sum;
      }
    }, 0),
  );
}

function cumulative(txs, priceAInB, direction, isUSD) {
  try {
    return buildCumulativeData(txs, undefined, priceAInB, direction, isUSD);
  } catch (err) {
    console.log('error creating cumulative data', err);
    return [];
  }
}

// The single value the always-mounted global provider still needs (budget gate).
export function computeSpentTotal(outgoingBTC, outgoingUSD, priceAInB) {
  const spentTotalBTC = sumSats(outgoingBTC, priceAInB, 'OUTGOING');
  const spentTotalUSD = sumDollars(outgoingUSD, priceAInB, 'OUTGOING');
  return Math.round(spentTotalBTC + dollarsToSats(spentTotalUSD, priceAInB));
}

// The analytics-only derived state (totals, counts, chart series). No spentTotal:
// that stays owned by the global provider and passes through the merged hook.
export function deriveAnalytics(
  { incomingBTC, outgoingBTC, incomingUSD, outgoingUSD },
  priceAInB,
) {
  return {
    incomeTotalBTC: sumSats(incomingBTC, priceAInB, 'INCOMING'),
    spentTotalBTC: sumSats(outgoingBTC, priceAInB, 'OUTGOING'),
    incomeTotalUSD: sumDollars(incomingUSD, priceAInB, 'INCOMING'),
    spentTotalUSD: sumDollars(outgoingUSD, priceAInB, 'OUTGOING'),
    incomeTxCountBTC: incomingBTC.length,
    spentTxCountBTC: outgoingBTC.length,
    incomeTxCountUSD: incomingUSD.length,
    spentTxCountUSD: outgoingUSD.length,
    cumulativeIncomeDataBTC: cumulative(incomingBTC, priceAInB, 'INCOMING'),
    cumulativeSpentDataBTC: cumulative(outgoingBTC, priceAInB, 'OUTGOING'),
    cumulativeIncomeDataUSD: cumulative(incomingUSD, priceAInB, 'INCOMING', true),
    cumulativeSpentDataUSD: cumulative(outgoingUSD, priceAInB, 'OUTGOING', true),
  };
}
