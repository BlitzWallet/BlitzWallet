import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  APPROXIMATE_SYMBOL,
  BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
  USDB_TOKEN_ID,
} from '../../../../constants';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import formatTokensNumber from '../../../../functions/lrc20/formatTokensBalance';
import { satsToDollars } from '../../../../functions/spark/flashnet';
import { isOrchestraSwapFailed } from '../../../../functions/spark/orchestraLightning';
import { getStableTx } from '../../../../functions/spark/enrichedTxCache';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import formatDate from '../../../../functions/formatDate';
import SkeletonBar from '../../../../functions/CustomElements/redesign/SkeletonBar';

export const dayStart = time => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const sectionTitle = start => formatDate(start, 'day');

// Raw SQLite rows (newest first) -> SectionList sections grouped by local day.
// Same skip rules as getFormattedHomepageTxsForSpark's view-all path, but
// returns plain data so the list stays virtualised and rows can memo.
export function buildActivitySections({
  transactions,
  tokens,
  enabledLRC20,
  t,
}) {
  const sections = [];
  const seen = new Set();
  const lnFundingIds = new Set();
  const todayStart = dayStart(Date.now());
  let section = null;

  for (const tx of transactions || []) {
    try {
      const details = JSON.parse(tx.details);
      if (details?.ln_funding_id) lnFundingIds.add(details.ln_funding_id);

      const isLRC20Payment = details.isLRC20Payment;
      if (
        !enabledLRC20 &&
        isLRC20Payment &&
        details.LRC20Token !== USDB_TOKEN_ID
      )
        continue;
      if (tx.paymentType === 'unknown') continue;
      if (details.senderIdentityPublicKey === process.env.SPARK_IDENTITY_PUBKEY)
        continue;
      if (seen.has(tx.sparkID)) continue;
      if (isLRC20Payment && !tokens?.[details.LRC20Token]) continue;
      if (
        tx.paymentType === 'lightning' &&
        tx.status === 'LIGHTNING_PAYMENT_INITIATED'
      )
        continue;
      seen.add(tx.sparkID);

      const time = new Date(details.time).getTime();
      const start = dayStart(time);
      if (!section || section.start !== start) {
        section = { key: String(start), start, title: '', data: [] };
        section.title = sectionTitle(start);
        sections.push(section);
      }

      section.data.push({
        id: tx.sparkID,
        tx: getStableTx(tx, details),
        time,
        isLRC20Payment,
        isFailed: tx.paymentStatus === 'failed' || isOrchestraSwapFailed(tx),
        showSwapConversion:
          details.performSwaptoUSD &&
          (!details.completedSwaptoUSD || !lnFundingIds.has(tx.sparkID)),
      });
    } catch (err) {
      if (__DEV__) console.log(err, 'error parsing activity tx');
    }
  }
  return sections;
}

// Items are rebuilt on every list rebuild; compare the fields a row reads so
// an unchanged tx doesn't re-render.
const sameItem = (a, b) =>
  a === b ||
  (a.tx === b.tx &&
    a.time === b.time &&
    a.isFailed === b.isFailed &&
    a.isLRC20Payment === b.isLRC20Payment &&
    a.showSwapConversion === b.showSwapConversion);

const rowPropsEqual = (prev, next) => {
  for (const key in next) {
    if (
      key === 'item' ? !sameItem(prev.item, next.item) : prev[key] !== next[key]
    )
      return false;
  }
  return true;
};

export default memo(function ActivityRow({
  item,
  navigate,
  userBalanceDenomination,
  tokens,
  poolInfoRef,
  swapLimits,
  sub,
  canEditMemo,
  neverHideBalance = true,
}) {
  const { t } = useTranslation();
  const { tx, time, isLRC20Payment, isFailed, showSwapConversion } = item;
  const details = tx.details;
  const isReceive = details.direction === 'INCOMING';
  const token = isLRC20Payment
    ? tokens?.[details.LRC20Token]?.tokenMetadata
    : null;

  const description = details.description?.trim();
  const title =
    !description || description === BLITZ_DEFAULT_PAYMENT_DESCRIPTION
      ? t(isReceive ? 'constants.received' : 'constants.sent')
      : description;

  const timeText = useMemo(() => formatDate(time, 'time'), [time]);

  const icon = isFailed
    ? 'CircleX'
    : tx.paymentStatus === 'pending' || showSwapConversion
    ? 'Clock'
    : details.showSwapLabel
    ? 'ArrowLeftRight'
    : isReceive
    ? 'ArrowDown'
    : 'ArrowUp';

  const handlePress = useCallback(() => {
    crashlyticsLogReport('Navigating to expanded tx from activity');
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'expandedTx',
      transaction: tx,
      canEditMemo,
    });
  }, [navigate, tx, canEditMemo]);

  const showSwapEstimate =
    showSwapConversion &&
    details.amount &&
    swapLimits.bitcoin <= details.amount;

  return (
    <ListRow
      onPress={handlePress}
      minHeight={64}
      titleStyle={styles.title}
      titleLines={2}
      subLines={1}
      lead={
        <Disc icon={icon} size={40} tone={isFailed ? 'danger' : 'default'} />
      }
      title={title}
      sub={sub ?? timeText}
      trailing={
        showSwapEstimate ? (
          <FormattedSatText
            neverHideBalance={neverHideBalance}
            globalBalanceDenomination={userBalanceDenomination}
            styles={styles.amount}
            frontText={APPROXIMATE_SYMBOL}
            balance={
              satsToDollars(details.amount, poolInfoRef.currentPriceAInB) *
              (1 - (poolInfoRef.lpFeeBps / 100 + 1) / 100)
            }
            useCustomLabel={true}
            customLabel={token?.tokenTicker || 'USDB'}
            useMillionDenomination={true}
          />
        ) : (
          <FormattedSatText
            neverHideBalance={neverHideBalance}
            globalBalanceDenomination={userBalanceDenomination}
            styles={styles.amount}
            frontText={
              userBalanceDenomination !== 'hidden'
                ? isReceive
                  ? '+'
                  : '-'
                : ''
            }
            balance={
              isLRC20Payment
                ? formatTokensNumber(details.amount, token?.decimals)
                : details.amount
            }
            useCustomLabel={isLRC20Payment}
            customLabel={token?.tokenTicker}
            useMillionDenomination={true}
          />
        )
      }
    />
  );
},
rowPropsEqual);

// Loading stand-in with the row's footprint (64 high, 40 disc, gap 12).
export function ActivityRowSkeleton() {
  return (
    <View style={styles.skeletonRow}>
      <SkeletonBar width={40} height={40} borderRadius={20} />
      <View style={styles.skeletonTexts}>
        <SkeletonBar width={140} height={14} borderRadius={7} />
        <SkeletonBar width={80} height={12} borderRadius={6} />
      </View>
      <SkeletonBar width={64} height={14} borderRadius={7} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, lineHeight: 21 },
  amount: { fontSize: 15, includeFontPadding: false },
  skeletonRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skeletonTexts: { flex: 1, gap: 6 },
});
