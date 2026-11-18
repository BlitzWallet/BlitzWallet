import { HIDDEN_BALANCE_CLOSE } from '../../constants';
import displayCorrectDenomination from '../displayCorrectDenomination';
import { dollarsToSats } from '../spark/swapAmountUtils';

// BarChart props for the dollars + bitcoin spending chart. Bar heights share
// one unit (sats at the current price); the legend values are never converted:
// dollars show as USD, bitcoin as sats. A series with nothing spent is left out,
// so a one-asset wallet sees its own bars alone; with nothing at all both stay
// as empty stubs.
export default function buildSpendingChart({
  aggregated,
  priceAInB,
  tokens,
  t,
  masterInfoObject,
  fiatStats,
  hideValues = false,
}) {
  const { usdValues, btcValues, usdTotal, btcTotal } = aggregated;
  const dollars = {
    color: tokens.dollar,
    values: usdValues.map(value => dollarsToSats(value, priceAInB)),
    legend: {
      color: tokens.dollar,
      label: t('constants.dollars_upper'),
      value: hideValues
        ? HIDDEN_BALANCE_CLOSE
        : displayCorrectDenomination({
            amount: usdTotal,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: 'fiat',
            },
            fiatStats,
            convertAmount: false,
            forceCurrency: 'USD',
          }),
    },
  };
  const bitcoin = {
    color: tokens.bitcoin,
    values: btcValues,
    legend: {
      color: tokens.bitcoin,
      label: t('constants.bitcoin_upper'),
      value: hideValues
        ? HIDDEN_BALANCE_CLOSE
        : displayCorrectDenomination({
            amount: btcTotal,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: 'sats',
            },
            fiatStats,
          }),
    },
  };

  const spent = [usdTotal > 0 && dollars, btcTotal > 0 && bitcoin].filter(
    Boolean,
  );
  const shown = spent.length ? spent : [dollars, bitcoin];
  return {
    series: shown,
    legend: spent.map(item => item.legend),
  };
}
