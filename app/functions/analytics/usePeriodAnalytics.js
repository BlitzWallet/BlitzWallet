import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { getTransactionsInRange } from '../spark/transactions';
import {
  ANALYTICS_TIMEFRAMES,
  aggregatePeriod,
  buildBuckets,
  getEarliestRelevantTime,
  getPeriodWindow,
} from './periods';

// Reads the outgoing payments of the selected timeframe (plus the period before
// it, for the comparison) and derives every number the analytics page shows.
export default function usePeriodAnalytics(timeframe) {
  const { sparkInformation, txsHashKey } = useSparkWallet();
  const { poolInfoRef } = useFlashnet();
  const { i18n } = useTranslation();
  const accountId = sparkInformation?.identityPubKey;
  const [loaded, setLoaded] = useState({
    timeframe: null,
    rows: null,
    nowMs: Date.now(),
  });
  // null until known. Any sent payment ever, so the page can show an empty
  // state instead of a chart of zeros.
  const [hasSpending, setHasSpending] = useState(null);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    // ponytail: counts any outgoing row (other LRC20 tokens too); filter by
    // spendingAsset if a token-only wallet ever lands on an all-zero chart.
    getTransactionsInRange({ accountId, direction: 'OUTGOING', limit: 1 }).then(
      rows => !cancelled && setHasSpending(rows.length > 0),
    );
    return () => {
      cancelled = true;
    };
  }, [accountId, txsHashKey]);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    const queryNow = Date.now();
    const window = getPeriodWindow(timeframe, new Date(queryNow));

    getTransactionsInRange({
      accountId,
      startTime: window.queryStartTime,
      endTime: window.queryEndTime,
      direction: 'OUTGOING',
    })
      .then(rows => {
        if (cancelled) return;
        setLoaded({ timeframe, rows: rows || [], nowMs: queryNow });
      })
      .catch(err => {
        console.error('analytics range read error', err);
        if (cancelled) return;
        setLoaded({ timeframe, rows: [], nowMs: queryNow });
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, timeframe, txsHashKey]);

  // Rows from another timeframe are never shown under the new one's title.
  const rows = loaded.timeframe === timeframe ? loaded.rows : null;
  const nowMs = loaded.nowMs;
  const priceAInB = poolInfoRef.currentPriceAInB;

  return useMemo(() => {
    const window = getPeriodWindow(timeframe, new Date(nowMs));
    // Only all time needs the oldest row (to pick its interval).
    const earliestTime =
      timeframe === ANALYTICS_TIMEFRAMES.ALL
        ? getEarliestRelevantTime(rows)
        : null;
    const buckets = buildBuckets({
      timeframe,
      window,
      nowTime: nowMs,
      earliestTime,
    });
    const aggregated = aggregatePeriod({
      txs: rows,
      priceAInB,
      buckets,
      startTime: window.startTime,
      previousStartTime: window.previousStartTime,
      previousEndTime: window.previousEndTime,
    });

    return {
      ...window,
      ...aggregated,
      buckets,
      isLoading: rows === null,
      hasSpending,
    };
    // i18n.language is here because the bucket labels come from formatDate.
  }, [rows, timeframe, nowMs, priceAInB, i18n.language, hasSpending]);
}
