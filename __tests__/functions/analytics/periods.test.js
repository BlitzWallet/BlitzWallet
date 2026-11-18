/* eslint-env jest */
// ---------------------------------------------------------------------------
// Locks the analytics timeframe math. These are the ways a historical chart
// can silently lie:
//   - a transaction just outside the selected window counted in a bucket
//   - a month/week boundary off by one day (DST, leap years, 30-day months)
//   - the last partial week of a month dropping its days
//   - BTC rows leaking into the dollar series and vice versa
//   - fees (paid in sats) not converted before joining a dollar total
//   - the previous period double-counting the current one
// ---------------------------------------------------------------------------

import {
  ANALYTICS_TIMEFRAMES,
  aggregatePeriod,
  buildBuckets,
  buildMonthWeekBuckets,
  getPeriodWindow,
} from '../../../app/functions/analytics/periods';

const USDB = 'btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87';
// satsToDollars(sats, 1000) === sats / 1000
const PRICE = 1000;

const at = (y, m, d, h = 12) => new Date(y, m, d, h, 0, 0);
const ms = date => date.getTime();
const tx = (time, details = {}, paymentType = 'spark') => ({
  paymentType,
  details: JSON.stringify({ time: ms(time), ...details }),
});

const NOW = at(2026, 10, 18, 10); // Nov 18 2026, 10:00 local

describe('getPeriodWindow', () => {
  test('today covers the whole local day and compares against yesterday', () => {
    const window = getPeriodWindow(ANALYTICS_TIMEFRAMES.TODAY, NOW);
    expect(window.startTime).toBe(ms(at(2026, 10, 18, 0)));
    expect(window.endTime).toBe(ms(at(2026, 10, 19, 0)));
    // The chart reaches back six days before today.
    expect(window.queryStartTime).toBe(ms(at(2026, 10, 12, 0)));
    expect(window.previousStartTime).toBe(ms(at(2026, 10, 17, 0)));
    expect(window.previousEndTime).toBe(window.startTime);
  });

  test('week starts on Sunday and compares against the week before', () => {
    const window = getPeriodWindow(ANALYTICS_TIMEFRAMES.WEEK, NOW);
    // Nov 18 2026 is a Wednesday, so the week starts Nov 15.
    expect(window.startTime).toBe(ms(at(2026, 10, 15, 0)));
    expect(window.endTime).toBe(ms(at(2026, 10, 22, 0)));
    expect(window.previousStartTime).toBe(ms(at(2026, 10, 8, 0)));
    expect(window.previousEndTime).toBe(window.startTime);
    // The query must reach back far enough for the comparison.
    expect(window.queryStartTime).toBe(window.previousStartTime);
  });

  test('month is the current calendar month, previous is the whole month before', () => {
    const window = getPeriodWindow(ANALYTICS_TIMEFRAMES.MONTH, NOW);
    expect(window.startTime).toBe(ms(at(2026, 10, 1, 0)));
    expect(window.endTime).toBe(ms(at(2026, 11, 1, 0)));
    expect(window.previousStartTime).toBe(ms(at(2026, 9, 1, 0)));
    expect(window.previousEndTime).toBe(window.startTime);
  });

  test('year is the calendar year, previous is the whole year before', () => {
    const window = getPeriodWindow(ANALYTICS_TIMEFRAMES.YEAR, NOW);
    expect(window.startTime).toBe(ms(at(2026, 0, 1, 0)));
    expect(window.endTime).toBe(ms(at(2027, 0, 1, 0)));
    expect(window.previousStartTime).toBe(ms(at(2025, 0, 1, 0)));
    expect(window.previousEndTime).toBe(window.startTime);
  });

  test('all time has no lower bound and no comparison', () => {
    const window = getPeriodWindow(ANALYTICS_TIMEFRAMES.ALL, NOW);
    expect(window.startTime).toBeNull();
    expect(window.queryStartTime).toBeNull();
    expect(window.previousStartTime).toBeNull();
    expect(window.endTime).toBe(ms(at(2026, 10, 19, 0)));
  });
});

describe('buildMonthWeekBuckets', () => {
  test('splits a 30 day month into 1-7, 8-14, 15-21, 22-28, 29-30', () => {
    const buckets = buildMonthWeekBuckets(NOW);
    expect(buckets.map(bucket => [bucket.startDay, bucket.endDay])).toEqual([
      [1, 7],
      [8, 14],
      [15, 21],
      [22, 28],
      [29, 30],
    ]);
    expect(buckets[0].startTime).toBe(ms(at(2026, 10, 1, 0)));
    expect(buckets[4].endTime).toBe(ms(at(2026, 11, 1, 0)));
  });

  test('a 28 day month has no trailing partial week', () => {
    const buckets = buildMonthWeekBuckets(at(2026, 1, 10));
    expect(buckets.map(bucket => [bucket.startDay, bucket.endDay])).toEqual([
      [1, 7],
      [8, 14],
      [15, 21],
      [22, 28],
    ]);
  });

  test('a leap February keeps its 29th day', () => {
    const buckets = buildMonthWeekBuckets(at(2024, 1, 10));
    expect(buckets.map(bucket => [bucket.startDay, bucket.endDay])).toEqual([
      [1, 7],
      [8, 14],
      [15, 21],
      [22, 28],
      [29, 29],
    ]);
    expect(buckets[4].endTime).toBe(ms(at(2024, 2, 1, 0)));
  });

  test('buckets are contiguous with no gaps or overlaps', () => {
    const buckets = buildMonthWeekBuckets(at(2026, 11, 15));
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i].startTime).toBe(buckets[i - 1].endTime);
    }
  });
});

describe('buildBuckets', () => {
  const window = getPeriodWindow(ANALYTICS_TIMEFRAMES.MONTH, NOW);

  test('today is the last 7 days ending today, today last', () => {
    const buckets = buildBuckets({
      timeframe: ANALYTICS_TIMEFRAMES.TODAY,
      window: getPeriodWindow(ANALYTICS_TIMEFRAMES.TODAY, NOW),
      nowTime: ms(NOW),
    });
    expect(buckets).toHaveLength(7);
    expect(buckets[0].startTime).toBe(ms(at(2026, 10, 12, 0)));
    expect(buckets[6].endTime).toBe(ms(at(2026, 10, 19, 0)));
    expect(buckets.map(bucket => bucket.label)).toEqual([
      'Thu',
      'Fri',
      'Sat',
      'Sun',
      'Mon',
      'Tue',
      'Wed',
    ]);
    expect(buckets.map(bucket => bucket.isCurrent)).toEqual(
      buckets.map((_, index) => index === 6),
    );
  });

  test('today totals only count today; earlier days are bars only', () => {
    const window = getPeriodWindow(ANALYTICS_TIMEFRAMES.TODAY, NOW);
    const buckets = buildBuckets({
      timeframe: ANALYTICS_TIMEFRAMES.TODAY,
      window,
      nowTime: ms(NOW),
    });
    const result = aggregatePeriod({
      txs: [
        tx(at(2026, 10, 18, 9), { direction: 'OUTGOING', amount: 100 }),
        tx(at(2026, 10, 14, 9), { direction: 'OUTGOING', amount: 50 }),
      ],
      priceAInB: PRICE,
      buckets,
      startTime: window.startTime,
    });
    expect(result.btcValues[2]).toBeGreaterThan(0);
    expect(result.btcTotal).toBe(result.btcValues[6]);
    expect(result.count).toBe(1);
  });

  test('yesterday feeds the comparison even though it has a bar', () => {
    const todayWindow = getPeriodWindow(ANALYTICS_TIMEFRAMES.TODAY, NOW);
    const buckets = buildBuckets({
      timeframe: ANALYTICS_TIMEFRAMES.TODAY,
      window: todayWindow,
      nowTime: ms(NOW),
    });
    const result = aggregatePeriod({
      txs: [
        tx(at(2026, 10, 18, 9), { direction: 'OUTGOING', amount: 100 }),
        tx(at(2026, 10, 17, 9), { direction: 'OUTGOING', amount: 40 }),
      ],
      priceAInB: PRICE,
      buckets,
      startTime: todayWindow.startTime,
      previousStartTime: todayWindow.previousStartTime,
      previousEndTime: todayWindow.previousEndTime,
    });
    expect(result.previousTotal).toBe(40);
    expect(result.btcTotal).toBe(100);
    expect(result.count).toBe(1);
  });

  test('this week is 7 daily buckets, today highlighted once', () => {
    const buckets = buildBuckets({
      timeframe: ANALYTICS_TIMEFRAMES.WEEK,
      window: getPeriodWindow(ANALYTICS_TIMEFRAMES.WEEK, NOW),
      nowTime: ms(NOW),
    });
    expect(buckets).toHaveLength(7);
    expect(buckets.filter(bucket => bucket.isCurrent)).toHaveLength(1);
    expect(buckets[3].startTime).toBe(ms(at(2026, 10, 18, 0)));
  });

  test('this month is the weekly day groups, labelled by their day range', () => {
    const buckets = buildBuckets({
      timeframe: ANALYTICS_TIMEFRAMES.MONTH,
      window,
      nowTime: ms(NOW),
    });
    expect(buckets.map(bucket => bucket.label)).toEqual([
      '1–7',
      '8–14',
      '15–21',
      '22–28',
      '29–30',
    ]);
    expect(buckets[2].isCurrent).toBe(true);
  });

  test('this year is 12 monthly buckets labelled by month', () => {
    const buckets = buildBuckets({
      timeframe: ANALYTICS_TIMEFRAMES.YEAR,
      window: getPeriodWindow(ANALYTICS_TIMEFRAMES.YEAR, NOW),
      nowTime: ms(NOW),
    });
    expect(buckets).toHaveLength(12);
    expect(buckets[0].startTime).toBe(ms(at(2026, 0, 1, 0)));
    expect(buckets[11].endTime).toBe(ms(at(2027, 0, 1, 0)));
    expect(buckets[10].isCurrent).toBe(true);
  });

  test('all time switches interval with the amount of history', () => {
    const allWindow = getPeriodWindow(ANALYTICS_TIMEFRAMES.ALL, NOW);
    const build = earliestTime =>
      buildBuckets({
        timeframe: ANALYTICS_TIMEFRAMES.ALL,
        window: allWindow,
        nowTime: ms(NOW),
        earliestTime,
      });

    // 10 days of history -> one bucket per day
    expect(build(ms(at(2026, 10, 8)))).toHaveLength(11);
    // ~3 months -> weekly
    const weekly = build(ms(at(2026, 7, 20)));
    expect(weekly[0].label).not.toMatch(/^\d{4}$/);
    expect(weekly.length).toBeGreaterThan(12);
    // 8 months -> monthly
    expect(build(ms(at(2026, 2, 3)))).toHaveLength(9);
    // 4 years -> yearly
    const yearly = build(ms(at(2023, 2, 3)));
    expect(yearly.map(bucket => bucket.label)).toEqual([
      '2023',
      '2024',
      '2025',
      '2026',
    ]);
  });

  test('all time with no history falls back to the last 12 months', () => {
    const buckets = buildBuckets({
      timeframe: ANALYTICS_TIMEFRAMES.ALL,
      window: getPeriodWindow(ANALYTICS_TIMEFRAMES.ALL, NOW),
      nowTime: ms(NOW),
      earliestTime: null,
    });
    expect(buckets).toHaveLength(12);
    expect(buckets[11].isCurrent).toBe(true);
  });
});

describe('aggregatePeriod', () => {
  // Ways the sent-only, two-series aggregation could lie:
  //   - received money or other tokens counted as spending
  //   - a savings transfer counted as spending or as a kind
  //   - the fee dropped from either series
  //   - the legend totals converted (dollars must stay USD, bitcoin sats)
  //   - the headline total not matching the budget's sat-equivalent sum
  //   - kinds not adding up to the total, or a kind missing when it is zero
  const window = getPeriodWindow(ANALYTICS_TIMEFRAMES.MONTH, NOW);
  const buckets = buildBuckets({
    timeframe: ANALYTICS_TIMEFRAMES.MONTH,
    window,
    nowTime: ms(NOW),
  });

  const txs = [
    // to a contact, Spark
    tx(at(2026, 10, 3), {
      direction: 'OUTGOING',
      amount: 1000,
      isLRC20Payment: false,
      sendingUUID: 'contact-1',
    }),
    // Lightning, 500 + 20 sat fee
    tx(
      at(2026, 10, 10),
      { direction: 'OUTGOING', amount: 500, fee: 20, isLRC20Payment: false },
      'lightning',
    ),
    // a gift
    tx(at(2026, 10, 15), {
      direction: 'OUTGOING',
      amount: 300,
      isLRC20Payment: false,
      isGift: true,
    }),
    // received: never shown
    tx(at(2026, 10, 5), {
      direction: 'INCOMING',
      amount: 4000,
      isLRC20Payment: false,
    }),
    // savings transfer: not spending
    tx(at(2026, 10, 4), {
      direction: 'OUTGOING',
      amount: 5000,
      isLRC20Payment: false,
      isSavings: true,
    }),
    // previous month, only feeds previousTotal
    tx(at(2026, 9, 30, 23), {
      direction: 'OUTGOING',
      amount: 700,
      isLRC20Payment: false,
    }),
    // outside both windows
    tx(at(2026, 8, 12), {
      direction: 'OUTGOING',
      amount: 900,
      isLRC20Payment: false,
    }),
    // dollars to a pool: $2.00 + a 100 sat fee ($0.10)
    tx(at(2026, 10, 6), {
      direction: 'OUTGOING',
      LRC20Token: USDB,
      isLRC20Payment: true,
      amount: 2_000_000,
      fee: 100,
      isPoolPayment: true,
    }),
    // another token: in neither series
    tx(at(2026, 10, 7), {
      direction: 'OUTGOING',
      LRC20Token: 'btkn1someOtherToken',
      isLRC20Payment: true,
      amount: 9_000_000,
      fee: 0,
    }),
    { details: 'not json' },
  ];

  const result = aggregatePeriod({
    txs,
    priceAInB: PRICE,
    buckets,
    previousStartTime: window.previousStartTime,
    previousEndTime: window.previousEndTime,
  });

  test('bitcoin bars are sats with fees, only outgoing, savings excluded', () => {
    expect(result.btcValues).toEqual([1000, 520, 300, 0, 0]);
    expect(result.btcTotal).toBe(1820);
  });

  test('dollar bars are USDB dollars plus the converted sat fee', () => {
    expect(result.usdValues).toEqual([2.1, 0, 0, 0, 0]);
    expect(result.usdTotal).toBe(2.1);
  });

  test('legend totals are never converted by price', () => {
    const atOtherPrice = aggregatePeriod({
      txs: txs.filter(row => !row.details.includes('"fee"')),
      priceAInB: PRICE * 3,
      buckets,
    });
    expect(atOtherPrice.btcTotal).toBe(1300);
    expect(atOtherPrice.usdTotal).toBe(0);
  });

  test('total and previous total are the sat-equivalent sum, like the budget', () => {
    // 1820 sats + $2.10 at 1000 sats per dollar
    expect(result.total).toBe(3920);
    expect(result.count).toBe(4);
    expect(result.previousTotal).toBe(700);
  });

  test('kinds add up to the total in a fixed order', () => {
    expect(result.kinds).toEqual([
      { key: 'contacts', value: 1000 },
      { key: 'pools', value: 2100 },
      { key: 'gifts', value: 300 },
      { key: 'other', value: 520 },
    ]);
    expect(result.kinds.reduce((sum, kind) => sum + kind.value, 0)).toBe(
      result.total,
    );
  });

  test('empty data yields zeroes, every kind at 0, and no previous period', () => {
    const empty = aggregatePeriod({ txs: [], priceAInB: PRICE, buckets });
    expect(empty.btcValues).toEqual([0, 0, 0, 0, 0]);
    expect(empty.usdValues).toEqual([0, 0, 0, 0, 0]);
    expect(empty.total).toBe(0);
    expect(empty.count).toBe(0);
    expect(empty.previousTotal).toBeNull();
    expect(empty.kinds).toEqual([
      { key: 'contacts', value: 0 },
      { key: 'pools', value: 0 },
      { key: 'gifts', value: 0 },
      { key: 'other', value: 0 },
    ]);
  });
});
