import {BITCOIN_SAT_TEXT, BITCOIN_SATS_ICON} from '../constants';
import {formatCurrency} from './formatCurrency';
import formatBalanceAmount from './formatNumber';
import numberConverter from './numberConverter';

export default function displayCorrectDenomination({
  amount,
  masterInfoObject,
  fiatStats,
}) {
  try {
    const convertedAmount = numberConverter(
      amount,
      masterInfoObject.userBalanceDenomination,
      masterInfoObject.userBalanceDenomination === 'fiat' ? 2 : 0,
      fiatStats,
    );
    const currencyText = fiatStats?.coin || 'USD';
    const showSymbol = masterInfoObject.satDisplay === 'symbol';
    const showSats =
      masterInfoObject.userBalanceDenomination === 'sats' ||
      masterInfoObject.userBalanceDenomination === 'hidden';

    const formattedCurrency = formatCurrency({
      amount: convertedAmount,
      code: currencyText,
    });
    const isSymbolInFront = formattedCurrency[3];
    const currencySymbol = formattedCurrency[2];
    const formatedSat = `${formatBalanceAmount(convertedAmount)}`;

    if (showSats) {
      if (showSymbol) return BITCOIN_SATS_ICON + formatedSat;
      else return formatedSat + ` ${BITCOIN_SAT_TEXT}`;
    } else {
      if (showSymbol && isSymbolInFront)
        return currencySymbol + formattedCurrency[1];
      else if (showSymbol && !isSymbolInFront)
        return formattedCurrency[1] + currencySymbol;
      else return formattedCurrency[1] + ` ${currencyText}`;
    }
  } catch (err) {
    console.log('display correct denomincation error', err);
    return '';
  }
}
