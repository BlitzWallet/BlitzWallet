// Ways the amount-input conversion can fail (written before the hook):
//  1. Switching unit leaves the number as-is, so "10000" sats becomes $10000.
//  2. Conversion runs in the wrong direction (multiplies instead of divides).
//  3. Switching back to the typed unit returns a re-rounded value (12345 → 12350).
//  4. Several switches in a row drift (each hop converts the last rounded value).
//  5. An empty input turns into "0" (or "0" turns into "") on switch.
//  6. A partial entry ("10.") or a non-number converts to NaN / garbage.
//  7. A missing or mismatched rate converts under the wrong currency symbol.
//  8. A rate update for the shown currency rewrites what the user typed.
//  9. After a switch, typing builds on the old unit's value.
// 10. A screen's own reset/prefill is overwritten by a pending conversion.
// 11. A token amount is converted as if it were sats or fiat.
// 12. Fiat results carry more than 2 decimals (keypad can't edit them).
// 13. The keypad's functional updater stops working through the hook.
import React, { useState } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import useAmountInputConversion, {
  convertAmountBetweenUnits,
  getAmountUnit,
} from '../app/hooks/useAmountInputConversion';

const SATS = { primaryDisplay: { denomination: 'sats' }, stats: null };
const USD = {
  primaryDisplay: { denomination: 'fiat', forceCurrency: 'USD' },
  stats: { coin: 'USD', value: 100000 },
};
const EUR = {
  primaryDisplay: { denomination: 'fiat', forceCurrency: 'EUR' },
  stats: { coin: 'EUR', value: 50000 },
};

function setup(initialUnit, initialAmount = '') {
  const out = { renders: 0 };
  function Probe({ unit, tokenUnit }) {
    const [amount, setAmount] = useState(initialAmount);
    const { exactSats } = useAmountInputConversion({
      amount,
      setAmount,
      primaryDisplay: unit.primaryDisplay,
      conversionFiatStats: unit.stats,
      tokenUnit,
    });
    out.amount = amount;
    out.exactSats = exactSats;
    out.setAmount = setAmount;
    out.renders += 1;
    return null;
  }
  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Probe unit={initialUnit} />);
  });
  out.switchTo = (unit, tokenUnit) =>
    act(() => renderer.update(<Probe unit={unit} tokenUnit={tokenUnit} />));
  out.type = value => act(() => out.setAmount(value));
  return out;
}

describe('convertAmountBetweenUnits', () => {
  const sats = getAmountUnit({ denomination: 'sats' });
  const usd = getAmountUnit(USD.primaryDisplay, USD.stats);
  const eur = getAmountUnit(EUR.primaryDisplay, EUR.stats);

  test('sats → fiat divides by the rate and keeps at most 2 decimals', () => {
    expect(convertAmountBetweenUnits('12345', sats, usd)).toBe('12.35');
    expect(convertAmountBetweenUnits('100000', sats, usd)).toBe('100');
    expect(convertAmountBetweenUnits('150000', sats, usd)).toBe('150');
    expect(convertAmountBetweenUnits('10050', sats, usd)).toBe('10.05');
  });

  test('fiat → sats rounds to whole sats', () => {
    expect(convertAmountBetweenUnits('10', usd, sats)).toBe('10000');
    expect(convertAmountBetweenUnits('0.015', usd, sats)).toBe('15');
    expect(convertAmountBetweenUnits('10.', usd, sats)).toBe('10000');
  });

  test('fiat → fiat uses the rate ratio, not a sats round-trip', () => {
    expect(convertAmountBetweenUnits('10', usd, eur)).toBe('5');
    expect(convertAmountBetweenUnits('0.1', usd, eur)).toBe('0.05');
  });

  test('empty stays empty, zero stays zero', () => {
    expect(convertAmountBetweenUnits('', sats, usd)).toBe('');
    expect(convertAmountBetweenUnits('0', sats, usd)).toBe('0');
    expect(convertAmountBetweenUnits('0', usd, sats)).toBe('0');
  });

  test('dust below one cent shows 0, large amounts stay exact', () => {
    expect(convertAmountBetweenUnits('1', sats, usd)).toBe('0');
    // 21M BTC at $100k
    expect(convertAmountBetweenUnits('2100000000000000', sats, usd)).toBe(
      '2100000000000',
    );
    expect(convertAmountBetweenUnits('2100000000000', usd, sats)).toBe(
      '2100000000000000',
    );
  });

  test('invalid input or missing/mismatched rate clears instead of guessing', () => {
    expect(convertAmountBetweenUnits('abc', sats, usd)).toBe('');
    expect(convertAmountBetweenUnits('-5', sats, usd)).toBe('');
    const noRate = getAmountUnit(EUR.primaryDisplay, null);
    expect(convertAmountBetweenUnits('100', sats, noRate)).toBe('');
    const mismatched = getAmountUnit(EUR.primaryDisplay, USD.stats);
    expect(convertAmountBetweenUnits('100', sats, mismatched)).toBe('');
  });

  test('token units never convert', () => {
    const token = getAmountUnit(SATS.primaryDisplay, null, 'FOO');
    expect(convertAmountBetweenUnits('100', token, sats)).toBe('');
    expect(convertAmountBetweenUnits('100', sats, token)).toBe('');
  });
});

describe('useAmountInputConversion', () => {
  test('switching unit converts the shown amount', () => {
    const h = setup(SATS);
    h.type('10000');
    h.switchTo(USD);
    expect(h.amount).toBe('10');
    h.switchTo(SATS);
    expect(h.amount).toBe('10000');
  });

  test('switching back restores exactly what was typed', () => {
    const h = setup(SATS);
    h.type('12345');
    h.switchTo(USD);
    expect(h.amount).toBe('12.35');
    h.switchTo(SATS);
    expect(h.amount).toBe('12345');
  });

  test('many switches do not drift', () => {
    const h = setup(USD);
    h.type('1.23');
    for (let i = 0; i < 5; i++) {
      h.switchTo(SATS);
      h.switchTo(EUR);
    }
    h.switchTo(USD);
    expect(h.amount).toBe('1.23');
    h.switchTo(SATS);
    expect(h.amount).toBe('1230');
  });

  test('typing after a switch starts from the converted value', () => {
    const h = setup(SATS);
    h.type('10000');
    h.switchTo(USD);
    h.type(prev => prev + '5');
    expect(h.amount).toBe('105');
    h.switchTo(SATS);
    expect(h.amount).toBe('105000');
  });

  test('empty and zero survive a switch', () => {
    const h = setup(SATS);
    h.switchTo(USD);
    expect(h.amount).toBe('');
    h.type('0');
    h.switchTo(SATS);
    expect(h.amount).toBe('0');
  });

  test('a rate update for the shown currency leaves the typed value alone', () => {
    const h = setup(USD);
    h.type('20');
    h.switchTo({ ...USD, stats: { coin: 'USD', value: 200000 } });
    expect(h.amount).toBe('20');
    // and later conversions use the updated rate
    h.switchTo(SATS);
    expect(h.amount).toBe('10000');
  });

  test('a screen reset wins over conversion', () => {
    const h = setup(SATS);
    h.type('5000');
    h.type('');
    h.switchTo(USD);
    expect(h.amount).toBe('');
  });

  test('switching to a currency with no rate clears the amount', () => {
    const h = setup(SATS);
    h.type('5000');
    h.switchTo({ ...EUR, stats: { coin: 'GBP', value: 40000 } });
    expect(h.amount).toBe('');
  });

  test('token amounts are cleared, not converted', () => {
    const h = setup(SATS);
    h.type('5000');
    h.switchTo(SATS, 'FOO');
    expect(h.amount).toBe('');
    h.type('7');
    h.switchTo(SATS);
    expect(h.amount).toBe('');
  });

  test('no committed render shows the old number under the new unit', () => {
    const seen = [];
    function Probe({ unit }) {
      const [amount, setAmount] = useState('10000');
      useAmountInputConversion({
        amount,
        setAmount,
        primaryDisplay: unit.primaryDisplay,
        conversionFiatStats: unit.stats,
      });
      React.useLayoutEffect(() => {
        seen.push(`${amount}@${unit.primaryDisplay.denomination}`);
      });
      return null;
    }
    let r;
    act(() => {
      r = ReactTestRenderer.create(<Probe unit={SATS} />);
    });
    act(() => r.update(<Probe unit={USD} />));
    expect(seen).toEqual(['10000@sats', '10@fiat']);
  });

  // 14. A switch that only re-displays the amount must not change what is
  //     requested: the typed value is kept exactly until the user edits.
  describe('exactSats', () => {
    test('typed sats shown in fiat still request the typed sats', () => {
      const h = setup(SATS);
      h.type('12345');
      expect(h.exactSats).toBe(null); // shown as typed: screen converts itself
      h.switchTo(EUR);
      expect(h.amount).toBe('6.17');
      expect(h.exactSats).toBe(12345);
      h.switchTo(USD);
      expect(h.exactSats).toBe(12345);
    });

    test('typed fiat shown in another fiat requests the typed fiat worth', () => {
      const h = setup(USD);
      h.type('5');
      h.switchTo(EUR);
      expect(h.amount).toBe('2.5');
      expect(h.exactSats).toBe(5000); // $5 at $100k, not €2.50 re-converted
    });

    test('fiat shown as sats needs no override (whole sats are exact)', () => {
      const h = setup(USD);
      h.type('1.23');
      h.switchTo(SATS);
      expect(h.exactSats).toBe(null);
    });

    test('editing after a switch drops the override', () => {
      const h = setup(SATS);
      h.type('12345');
      h.switchTo(USD);
      h.type(prev => prev.slice(0, -1));
      expect(h.exactSats).toBe(null);
    });

    test('switching back to the typed unit drops the override', () => {
      const h = setup(SATS);
      h.type('12345');
      h.switchTo(USD);
      h.switchTo(SATS);
      expect(h.exactSats).toBe(null);
    });

    test('setAmount gets the exact sats as its second argument on a switch', () => {
      const calls = [];
      function Probe({ unit }) {
        const [amount, setAmountState] = useState('12345');
        const setAmount = (value, exact) => {
          calls.push(exact);
          setAmountState(value);
        };
        useAmountInputConversion({
          amount,
          setAmount,
          primaryDisplay: unit.primaryDisplay,
          conversionFiatStats: unit.stats,
        });
        return null;
      }
      let r;
      act(() => {
        r = ReactTestRenderer.create(<Probe unit={SATS} />);
      });
      act(() => r.update(<Probe unit={USD} />));
      act(() => r.update(<Probe unit={SATS} />));
      expect(calls).toEqual([12345, null]);
    });

    test('empty, cleared or unconvertible amounts give no override', () => {
      const h = setup(SATS);
      h.switchTo(USD);
      expect(h.exactSats).toBe(null);
      h.switchTo(SATS);
      h.type('5000');
      h.switchTo({ ...EUR, stats: { coin: 'GBP', value: 40000 } });
      expect(h.amount).toBe('');
      expect(h.exactSats).toBe(null);
      h.switchTo(SATS, 'FOO');
      expect(h.exactSats).toBe(null);
    });
  });
});
