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
import { getTokenSparkTransactions } from '../../../../functions/spark/transactions';
import ActivityRow, {
  dayStart,
  sectionTitle,
} from '../viewAllComponents/activityRow';

// E4: the shared home projection holds this page's rows while it is mounted
// (max 25, no load-more), including under sheets opened from the page. Tokens
// are rare enough to fall outside it, so they read the table directly.

export default function ActivityCard({ scrollPosition, emptyText, style }) {
  const {
    sparkInformation,
    showTokensInformation,
    updateHomepageScrollPosition,
  } = useSparkWallet();
  const { poolInfo, swapLimits } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const onlyTokens = scrollPosition === 'tokens';
  const [tokenTxs, setTokenTxs] = useState(null);
  const { identityPubKey, transactions, tokens } = sparkInformation;
  // The row keeps the page's unit: never a sats-to-fiat conversion.
  const userBalanceDenomination =
    masterInfoObject.userBalanceDenomination === 'hidden' ? 'hidden' : 'sats';

  useEffect(() => {
    if (onlyTokens) return;
    updateHomepageScrollPosition(scrollPosition);
    return () => {
      updateHomepageScrollPosition('total');
    };
  }, [onlyTokens, scrollPosition, updateHomepageScrollPosition]);

  useEffect(() => {
    if (!onlyTokens || !identityPubKey) return;
    let isCurrent = true;
    getTokenSparkTransactions(identityPubKey).then(txs => {
      if (isCurrent) setTokenTxs(txs);
    });
    return () => {
      isCurrent = false;
    };
  }, [onlyTokens, identityPubKey, transactions]);

  // Depends on the tx list and token map only, so balance ticks don't rebuild it.
  const rows = useMemo(() => {
    const items = getFormattedHomepageTxsForSpark({
      transactions: onlyTokens ? tokenTxs : transactions,
      tokens,
      enabledLRC20: showTokensInformation,
      scrollPosition: onlyTokens ? 'total' : scrollPosition,
    });
    // One label per day, not per row.
    const today = dayStart(Date.now());
    const labels = new Map();
    for (const item of items) {
      const day = dayStart(item.time);
      if (!labels.has(day)) labels.set(day, sectionTitle(day, today, t));
      item.sub = labels.get(day);
    }
    return items;
  }, [
    transactions,
    tokenTxs,
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
        {rows.length ? (
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
        ) : onlyTokens && !tokenTxs ? null : (
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
