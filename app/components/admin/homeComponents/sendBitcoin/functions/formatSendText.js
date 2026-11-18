import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import formatBalanceAmount from '../../../../../functions/formatNumber';

// Display strings for the send pages' redesign heroes and rows. Same
// denomination and rounding the old FormattedBalanceInput / FormattedSatText
// lines used, in the display locked by useSendPaymentDetails. Text only: no
// amount sent is derived from these.
const inDisplay = (display, masterInfoObject) => ({
  ...masterInfoObject,
  userBalanceDenomination: display?.denomination === 'fiat' ? 'fiat' : 'sats',
});

// The typed or fixed amount, in the primary display (or the token's own unit).
export function formatAmountText(amount, details) {
  const {
    masterInfoObject,
    primaryDisplay,
    conversionFiatStats,
    isUsingLRC20,
    tokenDecimals,
    displayTokenTicker,
  } = details;
  if (isUsingLRC20) {
    return `${formatBalanceAmount(
      amount,
      false,
      masterInfoObject,
      tokenDecimals,
    )} ${(displayTokenTicker || '').toUpperCase()}`.trim();
  }
  return displayCorrectDenomination({
    amount: formatBalanceAmount(amount || 0, false, masterInfoObject),
    masterInfoObject: inDisplay(primaryDisplay, masterInfoObject),
    forceCurrency: primaryDisplay.forceCurrency,
    fiatStats: conversionFiatStats,
    convertAmount: false,
  });
}

// The other denomination under the hero; a token shows its name instead.
export function formatSecondaryText(sats, details) {
  const {
    masterInfoObject,
    secondaryDisplay,
    fiatStats,
    isUsingLRC20,
    seletctedToken,
  } = details;
  if (isUsingLRC20) return seletctedToken?.tokenMetadata?.tokenName || '';
  if (!secondaryDisplay) return '';
  return displayCorrectDenomination({
    amount: sats,
    masterInfoObject: inDisplay(secondaryDisplay, masterInfoObject),
    forceCurrency: secondaryDisplay.forceCurrency,
    fiatStats: secondaryDisplay.forceFiatStats || fiatStats,
  });
}

// A sat amount (the fee) in the primary display.
export function formatFeeText(sats, details) {
  const { masterInfoObject, primaryDisplay, fiatStats } = details;
  return displayCorrectDenomination({
    amount: sats,
    masterInfoObject: inDisplay(primaryDisplay, masterInfoObject),
    forceCurrency: primaryDisplay.forceCurrency,
    fiatStats: primaryDisplay.forceFiatStats || fiatStats,
  });
}
