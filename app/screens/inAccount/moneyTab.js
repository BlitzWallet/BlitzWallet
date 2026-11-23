import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import TopHeader from '../../functions/CustomElements/redesign/TopHeader';
import {
  FADE_TOP,
  FADE_TOP_BUFFER,
} from '../../functions/CustomElements/redesign/TopFade';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import PageTitle from '../../functions/CustomElements/redesign/PageTitle';
import ListCard from '../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../functions/CustomElements/redesign/ListRow';
import Disc from '../../functions/CustomElements/redesign/Disc';
import BarChart from '../../functions/CustomElements/redesign/BarChart';
import {
  CARD_RADIUS,
  FONT,
  HIDDEN_BALANCE_CLOSE,
  MAX_WEB_CONTENT_WIDTH,
} from '../../constants';
import { useReducedMotion } from '../../constants/motion';
import { TAB_ITEM_HEIGHT } from '../../../navigation/tabs';
import { useTabScrollToTop } from '../../../navigation/tabs/useTabScrollToTop';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useNodeContext } from '../../../context-store/nodeContext';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { useTheme } from '../../../context-store/theme';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { getMonthlyTransactions } from '../../functions/spark/transactions';
import {
  getAllSavingsTransactions,
  getSavingsGoals,
} from '../../functions/savings/savingsStorage';
import {
  computeGoalBalanceMicros,
  fromMicros,
} from '../../components/admin/homeComponents/savings/utils';
import { getAllLocalPools } from '../../functions/pools/poolsStorage';
import { getAllLocalGifts } from '../../functions/gift/giftsStorage';
import {
  aggregatePeriod,
  buildMonthWeekBuckets,
} from '../../functions/analytics/periods';
import buildSpendingChart from '../../functions/analytics/spendingChart';
import formatDate from '../../functions/formatDate';

const DONE_GIFT_STATES = ['Claimed', 'Reclaimed', 'Expired'];

// This month's spending per week, split into dollars and bitcoin (same sums as
// computeSpentTotal). priceAInB is kept so the bars share one unit.
async function loadWeeklySpent(identityPubKey, priceAInB) {
  const [outgoingBTC, outgoingUSD] = await Promise.all([
    getMonthlyTransactions(identityPubKey, 'OUTGOING'),
    getMonthlyTransactions(identityPubKey, 'OUTGOING', true),
  ]);
  const aggregated = aggregatePeriod({
    txs: [...outgoingBTC, ...outgoingUSD],
    priceAInB,
    buckets: buildMonthWeekBuckets(new Date()),
  });
  return { aggregated, priceAInB };
}

async function loadRowValues(uuid) {
  const [goals, savingsTxs, pools, gifts] = await Promise.all([
    getSavingsGoals(),
    getAllSavingsTransactions(),
    getAllLocalPools(),
    getAllLocalGifts(),
  ]);
  const now = Date.now();
  return {
    goalsCurrent: goals.reduce(
      (sum, goal) => sum + computeGoalBalanceMicros(goal.id, savingsTxs),
      0,
    ),
    goalsTarget: goals.reduce(
      (sum, goal) => sum + (goal.targetAmountMicros || 0),
      0,
    ),
    goalsCount: goals.length,
    activePools: pools.filter(
      pool => pool.creatorUUID === uuid && pool.status === 'active',
    ).length,
    unclaimedGifts: gifts.filter(
      gift => !DONE_GIFT_STATES.includes(gift.state) && gift.expireTime > now,
    ).length,
  };
}

// Counts the amount up alongside the bars (Money.dc.html motion note).
function useCountUp(target, duration, enabled) {
  const [value, setValue] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    let frame;
    const start = Date.now();
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, enabled]);
  return value;
}

function SpentCard({ weeklySpent, onPress }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const reduceMotion = useReducedMotion();

  const now = new Date();
  // Month labels don't need the data, so the axis is stable while it loads.
  const labels = buildMonthWeekBuckets(now).map(bucket => bucket.label);
  const total = weeklySpent?.aggregated.total || 0;
  const shown = useCountUp(
    total,
    labels.length * 120 + 400,
    !!weeklySpent && !reduceMotion,
  );
  const isHidden = masterInfoObject.userBalanceDenomination === 'hidden';
  const monthName = formatDate(now, 'month');
  const chart =
    weeklySpent &&
    buildSpendingChart({
      aggregated: weeklySpent.aggregated,
      priceAInB: weeklySpent.priceAInB,
      tokens,
      t,
      masterInfoObject,
      fiatStats,
      hideValues: isHidden,
    });

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.spentCard, { backgroundColor: tokens.surface }]}
    >
      <View style={styles.spentHeader}>
        <ThemeText
          content={t('money.spentIn', { month: monthName })}
          styles={[styles.spentLabel, { color: tokens.muted }]}
        />
        <ThemeIcon
          redesign
          iconName="ChevronRight"
          size={18}
          colorOverride={tokens.muted}
        />
      </View>
      <ThemeText
        CustomNumberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        content={
          isHidden
            ? HIDDEN_BALANCE_CLOSE
            : displayCorrectDenomination({
                amount: shown,
                masterInfoObject,
                fiatStats,
              })
        }
        styles={styles.spentAmount}
      />
      <View style={styles.chart}>
        <BarChart
          series={chart?.series || []}
          labels={labels}
          legend={chart?.legend || []}
          height={120}
          accessibilityLabel={t('money.weeklyChartLabel', { month: monthName })}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function MoneyTab() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { bottomPadding } = useGlobalInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { sparkInformation, txsHashKey } = useSparkWallet();
  const { poolInfoRef } = useFlashnet();
  const scrollViewRef = useRef(null);
  const [weeklySpent, setWeeklySpent] = useState(null);
  const [rowValues, setRowValues] = useState(null);

  useTabScrollToTop(scrollViewRef);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadRowValues(masterInfoObject?.uuid)
        .then(values => !cancelled && setRowValues(values))
        .catch(err => console.log('money tab row values error', err));
      return () => {
        cancelled = true;
      };
    }, [masterInfoObject?.uuid]),
  );

  useEffect(() => {
    if (!sparkInformation.identityPubKey) return;
    let cancelled = false;
    loadWeeklySpent(
      sparkInformation.identityPubKey,
      poolInfoRef.currentPriceAInB,
    )
      .then(spent => !cancelled && setWeeklySpent(spent))
      .catch(err => console.log('money tab spent error', err));
    return () => {
      cancelled = true;
    };
    // The price is here because the dollar bars are converted to sats with it;
    // a load before the pool price arrives would leave them at zero.
  }, [
    txsHashKey,
    sparkInformation.identityPubKey,
    poolInfoRef.currentPriceAInB,
  ]);

  const formatUsd = micros =>
    displayCorrectDenomination({
      amount: fromMicros(micros),
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: 'fiat',
      },
      fiatStats,
      forceCurrency: 'USD',
      convertAmount: false,
    });

  const nwcCount = Object.keys(masterInfoObject.NWC?.accounts || {}).length;
  const isHidden = masterInfoObject.userBalanceDenomination === 'hidden';

  const rows = [
    {
      key: 'savings',
      icon: 'Target',
      title: t('money.savingsGoals'),
      value:
        rowValues?.goalsCount && !isHidden
          ? t('money.goalProgress', {
              current: formatUsd(rowValues.goalsCurrent),
              target: formatUsd(rowValues.goalsTarget),
            })
          : '',
      route: 'SavingsStack',
    },
    {
      key: 'pools',
      icon: 'Users',
      title: t('settings.accountsPoolsScreen.poolsTitle'),
      value: rowValues?.activePools
        ? t('money.poolsCollecting', { count: rowValues.activePools })
        : '',
      route: 'PoolsStack',
    },
    {
      key: 'gifts',
      icon: 'Gift',
      title: t('screens.inAccount.giftPages.giftsHome.title'),
      value: rowValues?.unclaimedGifts
        ? t('money.giftsUnclaimed', { count: rowValues.unclaimedGifts })
        : '',
      route: 'GiftsStack',
    },
    // Nostr / NWC stays native only (WM-18).
    Platform.OS !== 'web' && {
      key: 'nwc',
      icon: 'Plug',
      title: t('settings.nwc.pageTitle'),
      value: nwcCount ? t('money.connections', { count: nwcCount }) : '',
      route: 'NosterWalletConnect',
    },
    {
      key: 'accumulation',
      icon: 'Inbox',
      title: t('screens.accumulationAddresses.title'),
      value: '',
      route: 'AccumulationAddressesHome',
    },
  ].filter(Boolean);

  return (
    <GlobalThemeView styles={styles.container} useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopHeader>
          <View style={styles.header}>
            <PageTitle text={t('money.title')} />
          </View>
        </TopHeader>
        <CustomScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            paddingTop: FADE_TOP + FADE_TOP_BUFFER,
            paddingBottom: bottomPadding + TAB_ITEM_HEIGHT + 40,
          }}
        >
          <SpentCard
            weeklySpent={weeklySpent}
            onPress={() => navigate.navigate('AnalyticsStack')}
          />
          <ListCard dividerInset={84} style={styles.rowsCard}>
            {rows.map(row => (
              <ListRow
                key={row.key}
                title={row.title}
                titleStyle={styles.rowTitle}
                minHeight={64}
                paddingVertical={8}
                lead={<Disc icon={row.icon} size={40} />}
                value={row.value ? row.value : undefined}
                trailing={row.value ? 'value' : undefined}
                showChevron
                chevronSize={18}
                onPress={() => navigate.navigate(row.route)}
              />
            ))}
          </ListCard>
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 0 },
  content: { alignSelf: 'center', width: '100%', flex: 1 },
  header: {
    minHeight: 44,
    justifyContent: 'center',
  },
  spentCard: { borderRadius: CARD_RADIUS, padding: 20 },
  spentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spentLabel: { fontSize: 14, lineHeight: 21, includeFontPadding: false },
  spentAmount: {
    marginTop: 2,
    fontFamily: FONT.Title_Medium,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -1.2,
    includeFontPadding: false,
  },
  chart: { marginTop: 20 },
  rowsCard: { marginTop: 12 },
  rowTitle: { fontSize: 15, lineHeight: 22 },
  rowValue: { fontSize: 14, lineHeight: 21, marginRight: 4 },
});
