import {
  marketRateReducer,
  initialMarketRate,
} from '../../app/functions/marketRateReducer';

const ready = (coin, value, fetchedAt) => ({
  coin,
  value,
  fetchedAt,
  status: 'ready',
});
const rate = (coin, value) => ({ coin, value });

describe('marketRateReducer (SM-1)', () => {
  test('initial is loading with null value', () => {
    expect(initialMarketRate('EUR')).toEqual({
      coin: 'EUR',
      value: null,
      fetchedAt: null,
      status: 'loading',
    });
  });

  test('RESET from ready USD to EUR drops the value', () => {
    const s = marketRateReducer(ready('USD', 90000, 5), {
      type: 'RESET',
      coin: 'EUR',
    });
    expect(s).toEqual(initialMarketRate('EUR'));
  });

  test('SEED in loading with matching coin -> ready (case-insensitive)', () => {
    const s = marketRateReducer(initialMarketRate('USD'), {
      type: 'SEED',
      rate: rate('usd', 50000),
      fetchedAt: 10,
    });
    expect(s).toEqual(ready('USD', 50000, 10));
  });

  test('SEED in failed -> ready', () => {
    const s = marketRateReducer(
      { ...initialMarketRate('USD'), status: 'failed' },
      { type: 'SEED', rate: rate('USD', 50000), fetchedAt: 10 },
    );
    expect(s.status).toBe('ready');
  });

  test('SEED with wrong coin or bad value is unchanged', () => {
    const init = initialMarketRate('USD');
    expect(
      marketRateReducer(init, {
        type: 'SEED',
        rate: rate('EUR', 5),
        fetchedAt: 1,
      }),
    ).toBe(init);
    expect(
      marketRateReducer(init, {
        type: 'SEED',
        rate: rate('USD', 0),
        fetchedAt: 1,
      }),
    ).toBe(init);
    expect(
      marketRateReducer(init, {
        type: 'SEED',
        rate: rate('USD', null),
        fetchedAt: 1,
      }),
    ).toBe(init);
  });

  test('SEED in ready is ignored', () => {
    const s = ready('USD', 90000, 5);
    expect(
      marketRateReducer(s, {
        type: 'SEED',
        rate: rate('USD', 1),
        fetchedAt: 99,
      }),
    ).toBe(s);
  });

  test('SEED never overwrites a newer fetchedAt', () => {
    const s = { ...initialMarketRate('USD'), fetchedAt: 50 };
    expect(
      marketRateReducer(s, {
        type: 'SEED',
        rate: rate('USD', 1),
        fetchedAt: 10,
      }),
    ).toBe(s);
  });

  test('FETCH_OK matching coin -> ready from any state', () => {
    for (const from of [
      initialMarketRate('USD'),
      { ...initialMarketRate('USD'), status: 'failed' },
      ready('USD', 1, 1),
    ]) {
      expect(
        marketRateReducer(from, {
          type: 'FETCH_OK',
          rate: rate('USD', 70000),
          fetchedAt: 20,
        }),
      ).toEqual(ready('USD', 70000, 20));
    }
  });

  test('FETCH_OK with USD into EUR machine leaves it unchanged', () => {
    const init = initialMarketRate('EUR');
    const s = marketRateReducer(init, {
      type: 'FETCH_OK',
      rate: rate('USD', 70000),
      fetchedAt: 20,
    });
    expect(s).toEqual(init);
    const r = ready('EUR', 60000, 3);
    expect(
      marketRateReducer(r, {
        type: 'FETCH_OK',
        rate: rate('USD', 70000),
        fetchedAt: 20,
      }),
    ).toEqual(r);
  });

  test('FETCH_OK with invalid value is treated as FETCH_FAILED', () => {
    expect(
      marketRateReducer(initialMarketRate('USD'), {
        type: 'FETCH_OK',
        rate: rate('USD', 0),
        fetchedAt: 1,
      }).status,
    ).toBe('failed');
    const r = ready('USD', 5, 1);
    expect(
      marketRateReducer(r, {
        type: 'FETCH_OK',
        rate: rate('USD', NaN),
        fetchedAt: 2,
      }),
    ).toEqual(r);
  });

  test('FETCH_FAILED: loading -> failed (value null)', () => {
    const s = marketRateReducer(initialMarketRate('USD'), {
      type: 'FETCH_FAILED',
    });
    expect(s.status).toBe('failed');
    expect(s.value).toBeNull();
  });

  test('FETCH_FAILED: ready stays ready, failed stays failed', () => {
    const r = ready('USD', 5, 1);
    expect(marketRateReducer(r, { type: 'FETCH_FAILED' })).toEqual(r);
    const f = { ...initialMarketRate('USD'), status: 'failed' };
    expect(marketRateReducer(f, { type: 'FETCH_FAILED' })).toEqual(f);
  });
});
