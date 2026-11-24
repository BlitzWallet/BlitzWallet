import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import useCurrencyDisplay from '../app/hooks/useCurrencyDisplay';
import { SATSPERBITCOIN } from '../app/constants';
import { resolveDisplayUsdRate } from '../app/functions/money';

function renderHook(params) {
  const result = {};

  function Probe({ p }) {
    Object.assign(result, useCurrencyDisplay(p));
    return null;
  }

  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Probe p={params} />);
  });
  result.rerender = next => act(() => renderer.update(<Probe p={next} />));

  return result;
}

const NOW = Date.now();

describe('useCurrencyDisplay', () => {
  const fiatStats = { coin: 'EUR', value: 50000, fetchedAt: NOW };
  const usdFiatStats = { coin: 'USD', value: 100000, fetchedAt: NOW };
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
    const gbpStats = { coin: 'GBP', value: 80000, fetchedAt: NOW };
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

  test('no rate: fiat preference falls back to sats and flags rateUnavailable', () => {
    const display = renderHook({
      displayCurrency: 'EUR',
      fiatStats: { coin: 'EUR', value: null, fetchedAt: null },
      usdFiatStats: null,
      currencyRates: {},
      masterInfoObject,
    });

    expect(display.primaryDisplay.denomination).toBe('sats');
    expect(display.rateUnavailable).toBe(true);
    expect(display.convertDisplayToSats('5')).toBe(5);
  });

  test('never converts EUR display with a USD rate', () => {
    const display = renderHook({
      displayCurrency: 'EUR',
      fiatStats: usdFiatStats,
      usdFiatStats,
      currencyRates: {},
      masterInfoObject,
    });

    expect(display.primaryDisplay.denomination).toBe('sats');
    expect(display.rateUnavailable).toBe(true);
    expect(display.convertDisplayToSats('5')).toBe(5);
  });

  test('stale rate (older than 65 min) falls back to sats', () => {
    const old = Date.now() - 66 * 60 * 1000;
    const display = renderHook({
      displayCurrency: 'EUR',
      fiatStats: { ...fiatStats, fetchedAt: old },
      usdFiatStats,
      currencyRates: {},
      masterInfoObject,
    });

    expect(display.primaryDisplay.denomination).toBe('sats');
    expect(display.rateUnavailable).toBe(true);
  });

  test('locked conversion rate survives a currency reset mid-send', () => {
    const base = {
      displayCurrency: 'USD',
      fiatStats: usdFiatStats,
      usdFiatStats,
      currencyRates: {},
      masterInfoObject,
      isSendingPayment: true,
    };
    const display = renderHook(base);
    display.rerender({
      ...base,
      fiatStats: { coin: 'EUR', value: null, fetchedAt: null },
    });
    expect(display.conversionFiatStats).toEqual(usdFiatStats);
    expect(display.primaryDisplay.forceCurrency).toBe('USD');
  });

  test('rate arriving later: sats amount converts to fiat equivalent, not reinterpreted', () => {
    const base = {
      displayCurrency: 'EUR',
      fiatStats: { coin: 'EUR', value: null, fetchedAt: null },
      usdFiatStats: null,
      currencyRates: {},
      masterInfoObject,
    };
    const display = renderHook(base);
    expect(display.convertSatsToDisplay(5000)).toBe(5000);
    display.rerender({ ...base, fiatStats });
    expect(display.primaryDisplay.denomination).toBe('fiat');
    expect(display.convertSatsToDisplay(5000)).toBe(
      ((5000 * fiatStats.value) / SATSPERBITCOIN).toFixed(2),
    );
  });

  test('pool-derived USD stats are usable for a non-USD user', () => {
    const display = renderHook({
      displayCurrency: 'USD',
      fiatStats,
      usdFiatStats: resolveDisplayUsdRate(null, 100000),
      currencyRates: {},
      masterInfoObject,
    });

    expect(display.primaryDisplay.denomination).toBe('fiat');
    expect(display.primaryDisplay.forceCurrency).toBe('USD');
    expect(display.convertDisplayToSats('1')).toBe(1000);
  });
});
