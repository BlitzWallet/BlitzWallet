// Timeframe maths for the analytics page and the Money tab's weekly chart.
//
// Everything here is local-calendar based: a "day" starts at the device's
// midnight and month/year boundaries come from the Date constructor, so DST
// days and leap years behave. Ranges are half open, [startTime, endTime), which
// is the same contract the SQL reads use, so a transaction can never land in
// two buckets or fall between two.
import formatDate from '../formatDate';
import { USDB_TOKEN_ID } from '../../constants';
import { getDollarsFromTx, getSatsFromTx } from './index';
import { convertToDecimals, dollarsToSats } from '../spark/swapAmountUtils';

const DAY_MS = 24 * 60 * 60 * 1000;
// Safety stop: no timeframe should ever ask for more lines than this.
const MAX_BUCKETS = 400;
// Today's chart: today plus the days before it, oldest first.
const TODAY_CHART_DAYS = 7;

export const ANALYTICS_TIMEFRAMES = {
  TODAY: 'today',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
  ALL: 'all',
};

// Kinds of spending, in display order. First match wins.
const KIND_KEYS = ['contacts', 'pools', 'gifts', 'other'];

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Weeks start on Sunday, matching the weekday order used in the chart labels.
export function startOfWeek(date) {
  const day = startOfDay(date);
  return addDays(day, -day.getDay());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

/**
 * The window a timeframe covers, plus the window before it for comparison.
 * `startTime` is null for all time (no lower bound). A query that needs the
 * comparison reads from queryStartTime so it can cover both in one pass.
 */
export function getPeriodWindow(timeframe, now = new Date()) {
  const endOfToday = addDays(startOfDay(now), 1).getTime();

  switch (timeframe) {
    case ANALYTICS_TIMEFRAMES.WEEK: {
      const start = startOfWeek(now);
      const previous = addDays(start, -7);
      return {
        startTime: start.getTime(),
        endTime: addDays(start, 7).getTime(),
        previousStartTime: previous.getTime(),
        previousEndTime: start.getTime(),
        queryStartTime: previous.getTime(),
        queryEndTime: addDays(start, 7).getTime(),
      };
    }
    case ANALYTICS_TIMEFRAMES.MONTH: {
      const start = startOfMonth(now);
      const previous = addMonths(start, -1);
      const end = addMonths(start, 1);
      return {
        startTime: start.getTime(),
        endTime: end.getTime(),
        previousStartTime: previous.getTime(),
        previousEndTime: start.getTime(),
        queryStartTime: previous.getTime(),
        queryEndTime: end.getTime(),
      };
    }
    case ANALYTICS_TIMEFRAMES.YEAR: {
      const start = startOfYear(now);
      const previous = new Date(start.getFullYear() - 1, 0, 1);
      const end = new Date(start.getFullYear() + 1, 0, 1);
      return {
        startTime: start.getTime(),
        endTime: end.getTime(),
        previousStartTime: previous.getTime(),
        previousEndTime: start.getTime(),
        queryStartTime: previous.getTime(),
        queryEndTime: end.getTime(),
      };
    }
    case ANALYTICS_TIMEFRAMES.ALL:
      return {
        startTime: null,
        endTime: endOfToday,
        previousStartTime: null,
        previousEndTime: null,
        queryStartTime: null,
        queryEndTime: endOfToday,
      };
    case ANALYTICS_TIMEFRAMES.TODAY:
    default: {
      const start = startOfDay(now);
      const previous = addDays(start, -1);
      return {
        startTime: start.getTime(),
        endTime: endOfToday,
        previousStartTime: previous.getTime(),
        previousEndTime: start.getTime(),
        // The chart shows the six days before today too; totals stay today only.
        queryStartTime: addDays(start, -(TODAY_CHART_DAYS - 1)).getTime(),
        queryEndTime: endOfToday,
      };
    }
  }
}

// Day-of-month groups: 1–7, 8–14, 15–21, 22–28 and a shorter 29–end, each
// labelled by its day range ("8–14"). The month explicitly starts on the 1st, so there is no
// leading partial group; only the last one can be short.
export function buildMonthWeekBuckets(
  now = new Date(),
  nowTime = now.getTime(),
) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const buckets = [];

  for (let startDay = 1; startDay <= daysInMonth; startDay += 7) {
    const endDay = Math.min(startDay + 6, daysInMonth);
    buckets.push({
      ...makeBucket(
        new Date(year, month, startDay),
        new Date(year, month, endDay + 1),
        nowTime,
        `${startDay}–${endDay}`,
      ),
      startDay,
      endDay,
    });
  }
  return buckets;
}

function makeBucket(start, end, nowTime, label) {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return {
    key: String(startTime),
    startTime,
    endTime,
    label,
    isCurrent: nowTime >= startTime && nowTime < endTime,
  };
}

function dailyBuckets(from, endTime, nowTime, labelStyle) {
  const buckets = [];
  let cursor = startOfDay(from);
  const lastDay = startOfDay(new Date(endTime - 1));
  while (
    cursor.getTime() <= lastDay.getTime() &&
    buckets.length < MAX_BUCKETS
  ) {
    const next = addDays(cursor, 1);
    buckets.push(
      makeBucket(cursor, next, nowTime, formatDate(cursor, labelStyle)),
    );
    cursor = next;
  }
  return buckets;
}

function weeklyBuckets(from, endTime, nowTime, labelStyle) {
  const buckets = [];
  let cursor = startOfWeek(from);
  while (cursor.getTime() < endTime && buckets.length < MAX_BUCKETS) {
    const next = addDays(cursor, 7);
    buckets.push(
      makeBucket(cursor, next, nowTime, formatDate(cursor, labelStyle)),
    );
    cursor = next;
  }
  return buckets;
}

function monthlyBuckets(from, endTime, nowTime, labelStyle) {
  const buckets = [];
  let cursor = startOfMonth(from);
  while (cursor.getTime() < endTime && buckets.length < MAX_BUCKETS) {
    const next = addMonths(cursor, 1);
    buckets.push(
      makeBucket(cursor, next, nowTime, formatDate(cursor, labelStyle)),
    );
    cursor = next;
  }
  return buckets;
}

function yearlyBuckets(from, endTime, nowTime) {
  const buckets = [];
  let cursor = startOfYear(from);
  while (cursor.getTime() < endTime && buckets.length < MAX_BUCKETS) {
    const next = new Date(cursor.getFullYear() + 1, 0, 1);
    buckets.push(
      makeBucket(cursor, next, nowTime, String(cursor.getFullYear())),
    );
    cursor = next;
  }
  return buckets;
}

/**
 * Buckets for the selected timeframe. Fixed periods use fixed intervals; all
 * time picks one from how much history there actually is, so the bars never
 * collapse into noise.
 */
export function buildBuckets({
  timeframe,
  window,
  nowTime,
  earliestTime = null,
}) {
  const endTime = window.endTime;
  const now = new Date(nowTime);

  switch (timeframe) {
    case ANALYTICS_TIMEFRAMES.TODAY:
      return dailyBuckets(
        addDays(new Date(window.startTime), -(TODAY_CHART_DAYS - 1)),
        endTime,
        nowTime,
        'weekday',
      );
    case ANALYTICS_TIMEFRAMES.WEEK:
      return dailyBuckets(
        new Date(window.startTime),
        endTime,
        nowTime,
        'weekday',
      );
    case ANALYTICS_TIMEFRAMES.MONTH:
      return buildMonthWeekBuckets(now, nowTime);
    case ANALYTICS_TIMEFRAMES.YEAR:
      return monthlyBuckets(
        new Date(window.startTime),
        endTime,
        nowTime,
        'monthNarrow',
      );
    case ANALYTICS_TIMEFRAMES.ALL:
    default: {
      // Nothing saved yet: show a year of empty months rather than one bar.
      if (!earliestTime) {
        return monthlyBuckets(
          addMonths(startOfMonth(now), -11),
          endTime,
          nowTime,
          'monthShort',
        );
      }
      const spanDays = (endTime - earliestTime) / DAY_MS;
      if (spanDays <= 31) {
        return dailyBuckets(
          new Date(earliestTime),
          endTime,
          nowTime,
          'monthDay',
        );
      }
      if (spanDays <= 120) {
        return weeklyBuckets(
          new Date(earliestTime),
          endTime,
          nowTime,
          'monthDay',
        );
      }
      if (spanDays <= 400) {
        return monthlyBuckets(
          new Date(earliestTime),
          endTime,
          nowTime,
          'monthShort',
        );
      }
      return yearlyBuckets(new Date(earliestTime), endTime, nowTime);
    }
  }
}

function parseTx(tx) {
  try {
    const details =
      typeof tx.details === 'string' ? JSON.parse(tx.details) : tx.details;
    if (!details) return null;
    const time = Number(details.time);
    if (!Number.isFinite(time)) return null;
    return { details, time };
  } catch {
    return null;
  }
}

function kindKey(details) {
  if (details.isPoolPayment) return 'pools';
  if (details.isGift) return 'gifts';
  if (typeof details.sendingUUID === 'string' && details.sendingUUID.trim())
    return 'contacts';
  return 'other';
}

// Outgoing bitcoin or USDB that counts as spending. Savings transfers are
// internal moves; other LRC20 tokens belong to neither series.
function spendingAsset(details) {
  if (details.direction !== 'OUTGOING' || details.isSavings) return null;
  if (!details.isLRC20Payment) return 'btc';
  if (details.LRC20Token === USDB_TOKEN_ID) return 'usd';
  return null;
}

function findBucketIndex(buckets, time) {
  for (let index = 0; index < buckets.length; index++) {
    const bucket = buckets[index];
    if (time >= bucket.startTime && time < bucket.endTime) return index;
  }
  return -1;
}

/** Oldest spending row. Sizes the all-time axis. */
export function getEarliestRelevantTime(txs) {
  let earliest = null;
  for (const tx of txs || []) {
    const parsed = parseTx(tx);
    if (!parsed || !spendingAsset(parsed.details)) continue;
    if (earliest === null || parsed.time < earliest) earliest = parsed.time;
  }
  return earliest;
}

/**
 * Bucket outgoing payments into a dollar series (USDB dollars) and a bitcoin
 * series (sats), both including the fee. The legend totals stay in those
 * native units; `total`, `previousTotal` and `kinds` are the sat-equivalent sum
 * at the current pool price, the same sum the budget uses.
 * With `startTime`, buckets before it are chart-only context: they get bars but
 * stay out of the totals, count and kinds (today's chart shows the past week).
 */
export function aggregatePeriod({
  txs,
  priceAInB,
  buckets,
  startTime = null,
  previousStartTime = null,
  previousEndTime = null,
}) {
  const usdValues = new Array(buckets.length).fill(0);
  const btcValues = new Array(buckets.length).fill(0);
  const kinds = Object.fromEntries(KIND_KEYS.map(key => [key, 0]));
  let count = 0;
  let previousTotal = 0;
  const hasPrevious = previousStartTime !== null && previousEndTime !== null;

  for (const tx of txs || []) {
    const parsed = parseTx(tx);
    if (!parsed) continue;
    const asset = spendingAsset(parsed.details);
    if (!asset) continue;

    const isUsd = asset === 'usd';
    const value = isUsd
      ? getDollarsFromTx(tx, priceAInB, 'OUTGOING')
      : getSatsFromTx(tx, priceAInB, 'OUTGOING');
    if (!(value > 0)) continue;
    const sats = isUsd ? dollarsToSats(value, priceAInB) : value;

    const bucketIndex = findBucketIndex(buckets, parsed.time);
    if (bucketIndex !== -1) {
      (isUsd ? usdValues : btcValues)[bucketIndex] += value;
      if (startTime === null || parsed.time >= startTime) {
        count += 1;
        kinds[kindKey(parsed.details)] += sats;
      }
    }
    // Counted apart from the buckets: today's chart also draws the six days
    // before today, so yesterday has a bar and still feeds previousTotal.
    if (
      hasPrevious &&
      parsed.time >= previousStartTime &&
      parsed.time < previousEndTime
    ) {
      previousTotal += sats;
    }
  }

  const roundedUsd = usdValues.map(value => convertToDecimals(value));
  const roundedBtc = btcValues.map(value => Math.round(value));
  const inPeriod = (_, index) =>
    startTime === null || buckets[index].startTime >= startTime;
  const usdTotal = convertToDecimals(
    roundedUsd.filter(inPeriod).reduce((a, b) => a + b, 0),
  );
  const btcTotal = roundedBtc.filter(inPeriod).reduce((a, b) => a + b, 0);

  return {
    usdValues: roundedUsd,
    btcValues: roundedBtc,
    usdTotal,
    btcTotal,
    total: Math.round(btcTotal + dollarsToSats(usdTotal, priceAInB)),
    count,
    previousTotal: hasPrevious ? Math.round(previousTotal) : null,
    kinds: KIND_KEYS.map(key => ({
      key,
      value: Math.round(kinds[key]),
    })),
  };
}
