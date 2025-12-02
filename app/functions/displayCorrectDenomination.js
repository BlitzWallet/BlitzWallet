import { BITCOIN_SAT_TEXT, BITCOIN_SATS_ICON } from '../constants';
import { formatCurrency } from './formatCurrency';
import formatBalanceAmount from './formatNumber';
import numberConverter from './numberConverter';

export default function displayCorrectDenomination({
  amount,
  masterInfoObject,
  fiatStats,
}) {
  try {
    const localBalanceDenomination = masterInfoObject.userBalanceDenomination;
    const currencyText = fiatStats?.coin || 'USD';

    const convertedAmount = numberConverter(
      amount,
      localBalanceDenomination,
      localBalanceDenomination === 'fiat' ? 2 : 0,
      fiatStats,
    );

    const formattedCurrency = formatCurrency({
      amount: convertedAmount,
      code: currencyText,
    });

    const isSymbolInFront = formattedCurrency[3];
    const currencySymbol = formattedCurrency[2];
    const showSymbol = masterInfoObject.satDisplay === 'symbol';
    const showSats =
      localBalanceDenomination === 'sats' ||
      localBalanceDenomination === 'hidden';

    const formattedSat = formatBalanceAmount(
      convertedAmount,
      true,
      masterInfoObject,
    );

    if (showSats) {
      return showSymbol
        ? `${BITCOIN_SATS_ICON}${formattedSat}`
        : `${formattedSat} ${BITCOIN_SAT_TEXT}`;
    }

    // Fiat display
    if (showSymbol && isSymbolInFront) {
      return `${currencySymbol}${formattedSat}`;
    }

    if (showSymbol && !isSymbolInFront) {
      return `${formattedSat}${currencySymbol}`;
    }

    return `${formattedSat} ${currencyText}`;
  } catch (err) {
    console.log('display correct denomination error', err);
    return '';
  }
}
