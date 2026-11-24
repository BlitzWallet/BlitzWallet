import { useState } from 'react';
import { SATSPERBITCOIN } from '../constants';

// The unit an amount input is typed in: SATS, a fiat code with its rate (fiat
// per BTC), or a token (no rate). A fiat unit whose stats belong to another
// coin gets no rate, so it is never converted under the wrong symbol.
export function getAmountUnit(primaryDisplay, conversionFiatStats, tokenUnit) {
  if (tokenUnit) return { code: `TOKEN:${tokenUnit}`, rate: null };
  if (primaryDisplay?.denomination !== 'fiat') {
    return { code: 'SATS', rate: null };
  }
  const statsCoin = conversionFiatStats?.coin?.toUpperCase() || '';
  const code = (primaryDisplay.forceCurrency || statsCoin).toUpperCase();
  const value = Number(conversionFiatStats?.value);
  return { code, rate: statsCoin === code && value > 0 ? value : null };
}

// Converts a typed amount string between units. Sats come out whole, fiat with
// at most 2 decimals (what the keypad allows). Returns '' when the value isn't
// a non-negative number or either side has no usable rate.
export function convertAmountBetweenUnits(value, from, to) {
  if (value === '' || value == null) return '';
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return '';

  const fromSats = from.code === 'SATS';
  const toSats = to.code === 'SATS';
  if ((!fromSats && !from.rate) || (!toSats && !to.rate)) return '';

  if (toSats) {
    const sats = fromSats ? num : (num * SATSPERBITCOIN) / from.rate;
    return String(Math.round(sats));
  }
  const cents = fromSats
    ? Math.round((num * to.rate) / (SATSPERBITCOIN / 100))
    : Math.round(((num * to.rate) / from.rate) * 100);
  return (cents / 100).toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Keeps an amount input's value meaning the same thing when the unit it is
 * shown in changes (display currency or paying asset). Works on the screen's
 * own amount state, so existing props, keypads and submit logic are unchanged.
 *
 * The last value the user typed (or the screen set) is the anchor. Every
 * switch converts from the anchor, never from a previously converted value,
 * so switching back restores exactly what was typed and repeated switches
 * don't drift.
 *
 * A switch only re-displays the amount: until the user edits it, the amount
 * requested stays the typed one. While a converted fiat value is shown,
 * `exactSats` is the typed amount in sats; screens submit
 * `exactSats ?? convertDisplayToSats(amount)`. It is null whenever the shown
 * value is itself exact (typed, or whole sats).
 *
 * Conversion happens during render, so no committed render ever pairs the old
 * number with the new unit.
 *
 * Must be called in the component that owns `amount` (setAmount is called
 * during render).
 *
 * @param {string} amount - the input's current string value
 * @param {function} setAmount - its setter. On a switch it is called as
 *   setAmount(shown, exactSats) so screens holding the amount in other state
 *   can store exactSats next to it; plain useState setters ignore it.
 * @param {object} primaryDisplay - from useCurrencyDisplay / usePaymentInputDisplay
 * @param {object} conversionFiatStats - rate for primaryDisplay
 * @param {string} [tokenUnit] - set when the amount is in token units; switching
 *   to or from a token clears the amount instead of converting
 * @returns {{ exactSats: number|null }}
 */
export default function useAmountInputConversion({
  amount,
  setAmount,
  primaryDisplay,
  conversionFiatStats,
  tokenUnit,
}) {
  const unit = getAmountUnit(primaryDisplay, conversionFiatStats, tokenUnit);
  const [tracked, setTracked] = useState(() => ({
    anchor: { value: amount, unit },
    unitCode: unit.code,
    shown: amount,
  }));

  if (amount !== tracked.shown) {
    // Typed, cleared or prefilled by the screen: the new source of truth.
    setTracked({
      anchor: { value: amount, unit },
      unitCode: unit.code,
      shown: amount,
    });
  } else if (unit.code !== tracked.unitCode) {
    const { anchor } = tracked;
    const next =
      anchor.unit.code === unit.code
        ? anchor.value
        : convertAmountBetweenUnits(anchor.value, anchor.unit, unit);
    setTracked({ anchor, unitCode: unit.code, shown: next });
    const nextExact =
      next !== '' && unit.rate && anchor.unit.code !== unit.code
        ? convertAmountBetweenUnits(anchor.value, anchor.unit, SATS_UNIT)
        : '';
    setAmount(next, nextExact === '' ? null : Number(nextExact));
  } else if (
    tracked.anchor.unit.code === unit.code &&
    tracked.anchor.unit.rate !== unit.rate
  ) {
    // Live rate moved for the anchor's currency; later switches use it.
    setTracked({ ...tracked, anchor: { value: tracked.anchor.value, unit } });
  }

  const { anchor } = tracked;
  const showsConversion =
    amount === tracked.shown &&
    amount !== '' &&
    tracked.unitCode === unit.code &&
    anchor.unit.code !== unit.code &&
    !!unit.rate;
  const anchorSats = showsConversion
    ? convertAmountBetweenUnits(anchor.value, anchor.unit, SATS_UNIT)
    : '';
  return { exactSats: anchorSats === '' ? null : Number(anchorSats) };
}

const SATS_UNIT = { code: 'SATS', rate: null };
