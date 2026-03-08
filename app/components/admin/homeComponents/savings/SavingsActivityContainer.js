import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import { SIZES } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import SavingsTransactionComponenet from './transactionContainer';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CustomButton from '../../../../functions/CustomElements/button';

export default function SavingsActivityContainer({ transactions = [] }) {
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const [visibleTransactionsCount, setVisibleTransactionsCount] = useState(10);

  const visibleTransactions = useMemo(
    () => transactions.slice(0, visibleTransactionsCount),
    [transactions, visibleTransactionsCount],
  );

  useEffect(() => {
    setVisibleTransactionsCount(prevCount =>
      Math.max(10, Math.min(prevCount, transactions.length)),
    );
  }, [transactions.length]);

  const handleLoadMoreTransactions = useCallback(() => {
    setVisibleTransactionsCount(prevCount =>
      Math.min(prevCount + 10, transactions.length),
    );
  }, [transactions.length]);

  const hasMoreTransactions = visibleTransactionsCount < transactions.length;

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.activityHeader}
        content={t('savings.activity.title')}
      />
      <View style={[styles.sectionCard, { backgroundColor: backgroundOffset }]}>
        {!visibleTransactions.length ? (
          <ThemeText
            styles={styles.emptyActivity}
            content={t('savings.activity.emptyState')}
          />
        ) : (
          visibleTransactions.map((item, index) => (
            <SavingsTransactionComponenet
              isLastIndex={index === visibleTransactions.length - 1}
              key={item.txId}
              item={item}
            />
          ))
        )}
      </View>

      {hasMoreTransactions && (
        <CustomButton
          buttonStyles={styles.loadMoreButton}
          actionFunction={handleLoadMoreTransactions}
          textContent={t('constants.loadMore')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
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
    opacity: 0.7,
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    padding: 14,
  },
  loadMoreButton: {
    marginTop: 10,
  },
});
