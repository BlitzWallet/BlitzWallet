import i18n from 'i18next';
import { STARTING_INDEX_FOR_GIFTS_DERIVE } from '../../../../constants';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';

// Shared display helpers for gift rows, cards and sheets.

// '#004'
export function giftNumberLabel(giftNum) {
  return `#${(giftNum - STARTING_INDEX_FOR_GIFTS_DERIVE)
    .toString()
    .padStart(3, '0')}`;
}

// Dollar gifts always show USD; bitcoin gifts always show sats.
export function formatGiftAmount({ gift, masterInfoObject, fiatStats }) {
  const isUSD = gift?.denomination === 'USD';
  return displayCorrectDenomination({
    amount: isUSD ? gift?.dollarAmount : gift?.amount,
    masterInfoObject: {
      ...masterInfoObject,
      userBalanceDenomination: isUSD ? 'fiat' : 'sats',
    },
    fiatStats,
    convertAmount: !isUSD,
    forceCurrency: isUSD ? 'USD' : false,
  });
}

// 'Oct 27'
export function giftShortDate(ms) {
  return new Date(ms).toLocaleDateString(i18n.language, {
    month: 'short',
    day: 'numeric',
  });
}

// 'asset' value for AssetDisc (savingsSheetParts).
export function giftAsset(gift) {
  return gift?.denomination === 'USD' ? 'dollar' : 'bitcoin';
}
