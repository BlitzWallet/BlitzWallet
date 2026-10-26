import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import { SIZES } from '../../../../constants';
import SavingsTransactionComponenet from './transactionContainer';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CustomButton from '../../../../functions/CustomElements/button';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import { useTheme } from '../../../../../context-store/theme';

const PAGE_SIZE = 20;

export default function SavingsActivityContainer({ transactions = [] }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [visibleTransactionsCount, setVisibleTransactionsCount] =
    useState(PAGE_SIZE);

  const visibleTransactions = useMemo(
    () => transactions.slice(0, visibleTransactionsCount),
    [transactions, visibleTransactionsCount],
  );

  useEffect(() => {
    setVisibleTransactionsCount(prevCount =>
      Math.max(PAGE_SIZE, Math.min(prevCount, transactions.length)),
    );
  }, [transactions.length]);

  const handleLoadMoreTransactions = useCallback(() => {
    setVisibleTransactionsCount(prevCount =>
      Math.min(prevCount + PAGE_SIZE, transactions.length),
    );
  }, [transactions.length]);

  const hasMoreTransactions = visibleTransactionsCount < transactions.length;

  return (
    <View style={styles.container}>
      <SectionHeader
        title={t('savings.activity.title')}
        style={styles.header}
      />

      <ListCard dividerInset={68}>
        {!visibleTransactions.length ? (
          <ThemeText
            key="empty"
            variant={'body'}
            styles={[styles.emptyActivity, { color: tokens.muted }]}
            content={t('savings.activity.emptyState')}
          />
        ) : (
          visibleTransactions.map(item => (
            <SavingsTransactionComponenet key={item.txId} item={item} />
          ))
        )}
      </ListCard>

      {hasMoreTransactions && (
        <CustomButton
          buttonStyles={styles.loadMoreButton}
          actionFunction={handleLoadMoreTransactions}
          textContent={t('constants.loadMore')}
          size={'regular'}
          tone={'secondary'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: { marginTop: 20, marginBottom: 8 },
  sectionCard: {
    borderRadius: 16,
    padding: 0,
    overflow: 'hidden',
  },

  activityHeader: {
    fontSize: SIZES.smedium,
    marginBottom: 8,
    includeFontPadding: false,
    marginTop: 14,
  },
  emptyActivity: {
    paddingVertical: 18,
  },
  loadMoreButton: {
    marginTop: 10,
  },
});
