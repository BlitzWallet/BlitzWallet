import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import { ListDivider } from '../../../../functions/CustomElements/redesign/ListCard';
import { formatBalanceAmount } from '../../../../functions';
import { getTimeDisplay } from '../../../../functions/contacts';
import {
  BTC_ASSET_ADDRESS,
  getUserSwapHistory,
} from '../../../../functions/spark/flashnet';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { useTheme } from '../../../../../context-store/theme';
import { AssetDisc } from '../savings/savingsSheetParts';
import { SwapBackRow, useSwapFormatters } from './swapParts';

const PAGE_SIZE = 20;

// Divider starts under the row text (lead disc 40 + gap 12, card padding 16).
const RowDivider = () => <ListDivider inset={68} />;

// Large disc = the asset swapped from, small badge = the asset received.
function SwapPairDisc({ isBtcToUsd }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.pair}>
      <AssetDisc asset={isBtcToUsd ? 'bitcoin' : 'dollar'} size={40} />
      <View style={[styles.badge, { borderColor: tokens.ground }]}>
        <AssetDisc asset={isBtcToUsd ? 'dollar' : 'bitcoin'} size={20} />
      </View>
    </View>
  );
}

function formatDate(timestamp) {
  const diffTime = Math.abs(Date.now() - new Date(timestamp).getTime());
  return getTimeDisplay(
    diffTime / (1000 * 60),
    diffTime / (1000 * 60 * 60),
    diffTime / (1000 * 60 * 60 * 24),
    diffTime / (1000 * 60 * 60 * 24 * 365),
  );
}

// Newest first, 20 at a time. Loads each time the step opens.
export default function SwapHistory({ onBack }) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { formatSats, formatUsd, masterInfoObject } = useSwapFormatters();
  const [swapHistory, setSwapHistory] = useState({ swaps: [], totalCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await getUserSwapHistory(
          currentWalletMnemoinc,
          PAGE_SIZE,
        );
        if (!mounted) return;
        if (result.didWork) {
          setSwapHistory({
            swaps: result.swaps,
            totalCount: result.totalCount,
          });
        } else {
          setLoadFailed(true);
        }
      } catch (err) {
        if (mounted) setLoadFailed(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [currentWalletMnemoinc]);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const result = await getUserSwapHistory(
        currentWalletMnemoinc,
        PAGE_SIZE,
        swapHistory.swaps.length,
      );
      if (result.didWork) {
        setSwapHistory(prev => ({
          swaps: [...prev.swaps, ...result.swaps],
          totalCount: result.totalCount,
        }));
      }
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'screens.inAccount.swapHistory.loadingSwapHistoryError',
        ),
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentWalletMnemoinc, swapHistory.swaps.length, navigate, t]);

  const renderItem = ({ item }) => {
    const isBtcToUsd = item.assetInAddress === BTC_ASSET_ADDRESS;
    const dollars = micros =>
      formatUsd(
        formatBalanceAmount(micros / Math.pow(10, 6), false, masterInfoObject),
      );
    const received = isBtcToUsd
      ? dollars(item.amountOut)
      : formatSats(item.amountOut);
    const sent = isBtcToUsd
      ? formatSats(item.amountIn)
      : dollars(item.amountIn);
    return (
      <ListRow
        lead={<SwapPairDisc isBtcToUsd={isBtcToUsd} />}
        title={t(
          isBtcToUsd
            ? 'screens.inAccount.swapHistory.bitcoinToDollars'
            : 'screens.inAccount.swapHistory.dollarsToBitcoin',
        )}
        titleStyle={styles.rowTitle}
        sub={formatDate(item.timestamp)}
        subLines={1}
        minHeight={64}
        trailing={
          <View style={styles.amounts}>
            <ThemeText styles={styles.received} content={`+${received}`} />
            <ThemeText
              styles={[styles.sent, { color: tokens.muted }]}
              content={sent}
            />
          </View>
        }
      />
    );
  };

  let body;
  if (isLoading) {
    body = <FullLoadingScreen showText={false} />;
  } else if (loadFailed || !swapHistory.swaps.length) {
    body = (
      <View style={styles.empty}>
        <EmptyState
          icon="History"
          title={t('screens.inAccount.swapHistory.noHistoryTitle')}
          sub={t(
            loadFailed
              ? 'screens.inAccount.swapHistory.loadingSwapHistoryError'
              : 'screens.inAccount.swapHistory.noHistoryDesc',
          )}
        />
      </View>
    );
  } else {
    body = (
      <FlatList
        style={[styles.list, { backgroundColor: tokens.ground }]}
        contentContainerStyle={styles.listContent}
        data={swapHistory.swaps}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={RowDivider}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <>
      <SwapBackRow
        onBack={onBack}
        title={t('screens.inAccount.swapHistory.pageTitle')}
      />
      {body}
      {!isLoading && swapHistory.swaps.length < swapHistory.totalCount && (
        <CustomButton
          buttonStyles={styles.loadMore}
          useLoading={isLoadingMore}
          disabled={isLoadingMore}
          textContent={t('constants.loadMore')}
          actionFunction={loadMore}
          size={'small'}
          tone={'secondary'}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 12, flexGrow: 0, borderRadius: 20 },
  listContent: { paddingHorizontal: 16, paddingVertical: 4 },
  pair: { width: 40, height: 40 },
  badge: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    borderWidth: 2,
    borderRadius: 12,
  },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  received: { fontSize: 15, lineHeight: 21, textAlign: 'right' },
  amounts: { alignItems: 'flex-end' },
  sent: { fontSize: 13, lineHeight: 19, textAlign: 'right' },
  empty: { marginTop: 40 },
  loadMore: { marginTop: 16, paddingHorizontal: 18 },
});
