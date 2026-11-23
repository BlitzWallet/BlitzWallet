import {
  BITCOIN_SAT_TEXT,
  BITCOIN_SATS_ICON,
  CUSTOM_TOKEN_CURRENCY_OPTIONS,
} from '../constants';
import { formatCurrency } from './formatCurrency';
import formatBalanceAmount from './formatNumber';
import formatTokensLabel from './lrc20/formatTokensLabel';
import numberConverter from './numberConverter';
import isFiatDustAmount from './isFiatDustAmount';

export default function displayCorrectDenomination({
  amount,
  masterInfoObject,
  fiatStats,
  useCustomLabel = false,
  customLabel = '',
  useMillionDenomination = false,
  forceCurrency = null,
  convertAmount = true,
  roundUpDust = false,
}) {
  try {
    const localBalanceDenomination = masterInfoObject.userBalanceDenomination;
    const currencyText = forceCurrency
      ? forceCurrency
      : masterInfoObject.fiatCurrency || 'USD';

    const showSymbol = masterInfoObject.satDisplay === 'symbol';
    const showSats =
      localBalanceDenomination === 'sats' ||
      localBalanceDenomination === 'hidden';

    if (useCustomLabel) {
      const formattedBalance = formatBalanceAmount(
        amount,
        useMillionDenomination,
        masterInfoObject,
      );

      const showCustomCurrencyLabel = CUSTOM_TOKEN_CURRENCY_OPTIONS.find(
        item => item.token === customLabel,
      );

      if (showCustomCurrencyLabel) {
        const currencyOptions = formatCurrency({
          amount: formattedBalance,
          code: showCustomCurrencyLabel.currency,
        });

        const isSymbolInFront = currencyOptions[3];
        const currencySymbol = currencyOptions[2];

        if (showSymbol && isSymbolInFront) {
          return `${currencySymbol}${currencyOptions[1]}`;
        }
        if (showSymbol && !isSymbolInFront) {
          return `${currencyOptions[1]}${currencySymbol}`;
        }
        return `${currencyOptions[1]} ${showCustomCurrencyLabel.currency}`;
      }

      const labelText = formatTokensLabel(customLabel);
      return `${formattedBalance} ${labelText}`;
    }

    // Callers that draw a DustChevron ask for sub-cent fiat to read 0.01.
    const isRoundedUpDust =
      roundUpDust &&
      isFiatDustAmount({
        amount,
        denomination: localBalanceDenomination,
        fiatStats,
        convertAmount,
      });

    const formattedBalance = isRoundedUpDust
      ? formatBalanceAmount('0.01', false, masterInfoObject)
      : convertAmount
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
