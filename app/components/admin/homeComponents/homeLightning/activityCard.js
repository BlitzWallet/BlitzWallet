import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import getFormattedHomepageTxsForSpark from '../../../../functions/combinedTransactionsSpark';
import { getTokenSparkTransactions } from '../../../../functions/spark/transactions';

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
  const { theme, darkModeType, tokens } = useGlobalThemeContext();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const onlyTokens = scrollPosition === 'tokens';
  const [tokenTxs, setTokenTxs] = useState(null);

  useEffect(() => {
    if (onlyTokens) return;
    updateHomepageScrollPosition(scrollPosition);
    return () => {
      updateHomepageScrollPosition('total');
    };
  }, [onlyTokens, scrollPosition, updateHomepageScrollPosition]);

  useEffect(() => {
    if (!onlyTokens || !sparkInformation.identityPubKey) return;
    let isCurrent = true;
    getTokenSparkTransactions(sparkInformation.identityPubKey).then(txs => {
      if (isCurrent) setTokenTxs(txs);
    });
    return () => {
      isCurrent = false;
    };
  }, [
    onlyTokens,
    sparkInformation.identityPubKey,
    sparkInformation.transactions,
  ]);

  const rows = useMemo(() => {
    const items = getFormattedHomepageTxsForSpark({
      sparkInformation: onlyTokens
        ? { ...sparkInformation, transactions: tokenTxs || [] }
        : sparkInformation,
      navigate,
      frompage: 'home',
      theme,
      darkModeType,
      // The row keeps the page's unit: never a sats-to-fiat conversion.
      userBalanceDenomination:
        masterInfoObject.userBalanceDenomination === 'hidden'
          ? 'hidden'
          : 'sats',
      enabledLRC20: showTokensInformation,
      scrollPosition: onlyTokens ? 'total' : scrollPosition,
      poolInfoRef: poolInfo,
      swapLimits,
      t,
    });
    return items.filter(item => item.key !== 'noTx');
  }, [
    sparkInformation,
    tokenTxs,
    onlyTokens,
    scrollPosition,
    navigate,
    theme,
    darkModeType,
    masterInfoObject.userBalanceDenomination,
    showTokensInformation,
    poolInfo,
    swapLimits,
    t,
  ]);

  return (
    <View style={[styles.card, { backgroundColor: tokens.surface }, style]}>
      <View style={styles.header}>
        <ThemeText
          content={t('wallet.homeLightning.home.activity')}
          styles={styles.title}
        />
      </View>
      {rows.length ? (
        rows.map(row => row.item)
      ) : onlyTokens && !tokenTxs ? null : (
        <ThemeText variant="hint" content={emptyText} styles={styles.empty} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
  },
  header: { minHeight: 48, justifyContent: 'center' },
  title: { fontSize: 16, lineHeight: 22, includeFontPadding: false },
  empty: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
    includeFontPadding: false,
  },
});
