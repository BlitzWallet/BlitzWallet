import { BITCOIN_SAT_TEXT, BITCOIN_SATS_ICON } from '../constants';
import { formatCurrency } from './formatCurrency';
import formatBalanceAmount from './formatNumber';
import numberConverter from './numberConverter';

export default function displayCorrectDenomination({
  amount,
  masterInfoObject,
  fiatStats,
  useCustomLabel = false,
  customLabel = '',
  useMillionDenomination = false,
  forceCurrency = null,
  convertAmount = true,
}) {
  try {
    const localBalanceDenomination = masterInfoObject.userBalanceDenomination;
    const currencyText = forceCurrency
      ? forceCurrency
      : fiatStats?.coin || 'USD';

    if (useCustomLabel) {
      const formattedBalance = formatBalanceAmount(
        amount,
        useMillionDenomination,
        masterInfoObject,
      );
      const labelText = customLabel?.toUpperCase()?.slice(0, 10) || '';
      return `${formattedBalance} ${labelText}`;
    }

    const formattedBalance = convertAmount
      ? formatBalanceAmount(
          numberConverter(
            amount,
            localBalanceDenomination,
            localBalanceDenomination === 'fiat' ? 2 : 0,
            fiatStats,
          ),
          useMillionDenomination,
          masterInfoObject,
        )
      : amount;

    const showSymbol = masterInfoObject.satDisplay === 'symbol';
    const showSats =
      localBalanceDenomination === 'sats' ||
      localBalanceDenomination === 'hidden';

    if (showSats) {
      return showSymbol
        ? `${BITCOIN_SATS_ICON}${formattedBalance}`
        : `${formattedBalance} ${BITCOIN_SAT_TEXT}`;
    }

    // Fiat display
    const currencyOptions = formatCurrency({
      amount: formattedBalance,
      code: currencyText,
    });
    const isSymbolInFront = currencyOptions[3];
    const currencySymbol = currencyOptions[2];

    if (showSymbol && isSymbolInFront) {
      return `${currencySymbol}${currencyOptions[1]}`;
    }
    if (showSymbol && !isSymbolInFront) {
      return `${currencyOptions[1]}${currencySymbol}`;
    }
    return `${currencyOptions[1]} ${currencyText}`;
  } catch (err) {
    console.log('display correct denomination error', err);
    return '';
  }
}
