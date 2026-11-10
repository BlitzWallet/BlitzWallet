import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { ThemeText } from '../../../../functions/CustomElements';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import getFormattedHomepageTxsForSpark from '../../../../functions/combinedTransactionsSpark';
import {
  getAllSparkTransactions,
  getTokenSparkTransactions,
} from '../../../../functions/spark/transactions';
import ActivityRow, {
  ActivityRowSkeleton,
  dayStart,
  sectionTitle,
} from '../viewAllComponents/activityRow';

// The card reads its own rows from SQLite while mounted (max 25, no
// load-more) and re-reads on every tx event (txsVersion). Newest-first
// windows widen only while a full window still can't fill the card, so sparse
// histories (few USD txs deep in the table) stay correct without a full scan.
const ROW_LIMIT = 25;
const READ_WINDOWS = [50, 200, 800, null];
const SKELETON_ROWS = [0, 1, 2];

export default function ActivityCard({ scrollPosition, emptyText, style }) {
  const { sparkInformation, showTokensInformation, txsVersion } =
    useSparkWallet();
  const { poolInfo, swapLimits } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const onlyTokens = scrollPosition === 'tokens';
  // null = first read still running (skeleton); reloads keep the old rows.
  const [transactions, setTransactions] = useState(null);
  const { identityPubKey, tokens } = sparkInformation;
  // The row keeps the page's unit: never a sats-to-fiat conversion.
  const userBalanceDenomination =
    masterInfoObject.userBalanceDenomination === 'hidden' ? 'hidden' : 'sats';

  const buildRows = txs =>
    getFormattedHomepageTxsForSpark({
      transactions: txs,
      tokens,
      enabledLRC20: showTokensInformation,
      scrollPosition: onlyTokens ? 'total' : scrollPosition,
      limit: ROW_LIMIT,
    });

  useEffect(() => {
    if (!identityPubKey) return;
    let isCurrent = true;
    (async () => {
      if (onlyTokens) return getTokenSparkTransactions(identityPubKey);
      for (const limit of READ_WINDOWS) {
        const txs = await getAllSparkTransactions({
          limit,
          accountId: identityPubKey,
        });
        if (!isCurrent) return null;
        if (
          limit === null ||
          txs.length < limit ||
          buildRows(txs).length >= ROW_LIMIT
        )
          return txs;
      }
    })().then(txs => {
      if (isCurrent && txs) setTransactions(txs);
    });
    return () => {
      isCurrent = false;
    };
  }, [onlyTokens, scrollPosition, identityPubKey, txsVersion]);

  // Depends on the tx list and token map only, so balance ticks don't rebuild it.
  const rows = useMemo(() => {
    if (!transactions) return null;
    const items = buildRows(transactions);
    // One label per day, not per row.
    const today = dayStart(Date.now());
    const labels = new Map();
    for (const item of items) {
      const day = dayStart(item.time);
      if (!labels.has(day)) labels.set(day, sectionTitle(day));
      item.sub = labels.get(day);
    }
    return items;
  }, [
    transactions,
    tokens,
    onlyTokens,
    scrollPosition,
    showTokensInformation,
    t,
  ]);

  return (
    <ListCard style={[styles.card, style]}>
      <View>
        <View style={styles.header}>
          <ThemeText
            content={t('wallet.homeLightning.home.activity')}
            styles={styles.title}
          />
        </View>
        {!rows ? (
          <View style={styles.rows}>
            {SKELETON_ROWS.map(key => (
              <ActivityRowSkeleton key={key} />
            ))}
          </View>
        ) : rows.length ? (
          <ListCard dividerInset={68} style={styles.rows}>
            {rows.map(item => (
              <ActivityRow
                key={item.id}
                item={item}
                sub={item.sub}
                navigate={navigate}
                userBalanceDenomination={userBalanceDenomination}
                neverHideBalance={false}
                tokens={tokens}
                poolInfoRef={poolInfo}
                swapLimits={swapLimits}
              />
            ))}
          </ListCard>
        ) : (
          <ThemeText variant="hint" content={emptyText} styles={styles.empty} />
        )}
      </View>
    </ListCard>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 2, paddingBottom: 4 },
  rows: { paddingHorizontal: 0 },
  header: { minHeight: 48, justifyContent: 'center' },
  title: { fontSize: 16, lineHeight: 22, includeFontPadding: false },
  empty: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
    includeFontPadding: false,
  },
});
