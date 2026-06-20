import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import useCurrencyDisplay from '../app/hooks/useCurrencyDisplay';
import { SATSPERBITCOIN } from '../app/constants';

function renderHook(params) {
  const result = {};

  function Probe() {
    Object.assign(result, useCurrencyDisplay(params));
    return null;
  }

  act(() => {
    ReactTestRenderer.create(<Probe />);
  });

  return result;
}

describe('useCurrencyDisplay', () => {
  const fiatStats = { coin: 'EUR', value: 50000 };
  const usdFiatStats = { coin: 'USD', value: 100000 };
  const masterInfoObject = { fiatCurrency: 'EUR' };

  test('converts SATS display amounts as literal sats', () => {
    const display = renderHook({
      displayCurrency: 'SATS',
      fiatStats,
      usdFiatStats,
      currencyRates: {},
      masterInfoObject,
    });

    expect(display.primaryDisplay).toEqual({
      denomination: 'sats',
      forceCurrency: null,
      forceFiatStats: null,
    });
    expect(display.convertDisplayToSats('1234')).toBe(1234);
    expect(display.showDot).toBe(false);
  });

  test('uses USD stats for USD display conversion', () => {
    const display = renderHook({
      displayCurrency: 'USD',
      fiatStats,
      usdFiatStats,
      currencyRates: {},
      masterInfoObject,
    });

    expect(display.primaryDisplay.forceCurrency).toBe('USD');
    expect(display.conversionFiatStats).toBe(usdFiatStats);
    expect(display.convertDisplayToSats('2')).toBe(
      Math.round((SATSPERBITCOIN / usdFiatStats.value) * 2),
    );
    expect(display.showDot).toBe(true);
  });

  test('uses fetched fiat stats for non-device fiat display conversion', () => {
    const gbpStats = { coin: 'GBP', value: 80000 };
    const display = renderHook({
      displayCurrency: 'GBP',
      fiatStats,
      usdFiatStats,
      currencyRates: { GBP: gbpStats },
      masterInfoObject,
    });

    expect(display.primaryDisplay.forceCurrency).toBe('GBP');
    expect(display.primaryDisplay.forceFiatStats).toBe(gbpStats);
    expect(display.conversionFiatStats).toBe(gbpStats);
    expect(display.convertDisplayToSats('3.5')).toBe(
      Math.round((SATSPERBITCOIN / gbpStats.value) * 3.5),
    );
  });

  test('buildAmountSnapshot captures fiat entry verbatim with integer sats', () => {
    const display = renderHook({
      displayCurrency: 'USD',
      fiatStats,
      usdFiatStats,
      currencyRates: {},
      masterInfoObject,
    });

    const snapshot = display.buildAmountSnapshot('10.00');

    expect(snapshot.displayAmount).toBe('10.00'); // verbatim, not "10"
    expect(snapshot.displayDenomination).toBe('fiat');
    expect(snapshot.displayCurrency).toBe('USD');
    expect(snapshot.sats).toBe(
      Math.round((SATSPERBITCOIN / usdFiatStats.value) * 10),
    );
    expect(Number.isInteger(snapshot.sats)).toBe(true);
  });

  test('buildAmountSnapshot captures sats entry as literal integer sats', () => {
    const display = renderHook({
      displayCurrency: 'SATS',
      fiatStats,
      usdFiatStats,
      currencyRates: {},
      masterInfoObject,
    });

    const snapshot = display.buildAmountSnapshot('1234');

    expect(snapshot.displayAmount).toBe('1234');
    expect(snapshot.displayDenomination).toBe('sats');
    expect(snapshot.displayCurrency).toBe(null);
    expect(snapshot.sats).toBe(1234);
  });
});
