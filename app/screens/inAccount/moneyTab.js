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
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import PageTitle from '../../functions/CustomElements/redesign/PageTitle';
import ListCard from '../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../functions/CustomElements/redesign/ListRow';
import Disc from '../../functions/CustomElements/redesign/Disc';
import DailyBarChart from '../../functions/CustomElements/redesign/DailyBarChart';
import { FONT, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import { useReducedMotion } from '../../constants/motion';
import { TAB_ITEM_HEIGHT } from '../../../navigation/tabs';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useNodeContext } from '../../../context-store/nodeContext';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { useTheme } from '../../../context-store/theme';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { getMonthlyTransactions } from '../../functions/spark/transactions';
import { getDollarsFromTx, getSatsFromTx } from '../../functions/analytics';
import {
  convertToDecimals,
  dollarsToSats,
} from '../../functions/spark/swapAmountUtils';
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

const DONE_GIFT_STATES = ['Claimed', 'Reclaimed', 'Expired'];

// Sats spent per day of the current month (same sums as computeSpentTotal).
async function loadDailySpent(identityPubKey, priceAInB) {
  const [outgoingBTC, outgoingUSD] = await Promise.all([
    getMonthlyTransactions(identityPubKey, 'OUTGOING'),
    getMonthlyTransactions(identityPubKey, 'OUTGOING', true),
  ]);
  const now = new Date();
  const days = new Array(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
  ).fill(0);
  const add = (tx, sats) => {
    try {
      days[new Date(JSON.parse(tx.details).time).getDate() - 1] += sats;
    } catch {
      // skip malformed tx
    }
  };
  outgoingBTC.forEach(tx => add(tx, getSatsFromTx(tx, priceAInB, 'OUTGOING')));
  outgoingUSD.forEach(tx =>
    add(
      tx,
      dollarsToSats(
        convertToDecimals(getDollarsFromTx(tx, priceAInB, 'OUTGOING')),
        priceAInB,
      ),
    ),
  );
  return days.map(Math.round);
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

function SpentCard({ dailySpent, onPress }) {
  const { t, i18n } = useTranslation();
  const { tokens } = useTheme();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const reduceMotion = useReducedMotion();

  const now = new Date();
  const todayIndex = now.getDate() - 1;
  const total = dailySpent ? dailySpent.reduce((a, b) => a + b, 0) : 0;
  const shown = useCountUp(
    total,
    todayIndex * 30 + 500,
    !!dailySpent && !reduceMotion,
  );
  const isHidden = masterInfoObject.userBalanceDenomination === 'hidden';
  const dayLabel = day =>
    new Date(now.getFullYear(), now.getMonth(), day).toLocaleDateString(
      i18n.language,
      { month: 'short', day: 'numeric' },
    );
  const monthName = now.toLocaleDateString(i18n.language, { month: 'long' });

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
            ? 'A A A A A'
            : displayCorrectDenomination({
                amount: shown,
                masterInfoObject,
                fiatStats,
              })
        }
        styles={[styles.spentAmount, isHidden && styles.hiddenAmount]}
      />
      <View style={styles.chart}>
        <DailyBarChart
          values={dailySpent || new Array(todayIndex + 1).fill(0)}
          todayIndex={todayIndex}
          accessibilityLabel={t('money.chartLabel', { month: monthName })}
        />
      </View>
      <View style={styles.axis}>
        {[
          dayLabel(1),
          t('money.today'),
          dayLabel(dailySpent?.length || 31),
        ].map(label => (
          <ThemeText
            key={label}
            content={label}
            styles={[styles.axisLabel, { color: tokens.muted }]}
          />
        ))}
      </View>
    </TouchableOpacity>
  );
}

export default function MoneyTab({ navigation }) {
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
  const [dailySpent, setDailySpent] = useState(null);
  const [rowValues, setRowValues] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (!navigation) return;
      return navigation.addListener('tabPress', () => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      });
    }, [navigation]),
  );

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
    loadDailySpent(
      sparkInformation.identityPubKey,
      poolInfoRef.currentPriceAInB,
    )
      .then(days => !cancelled && setDailySpent(days))
      .catch(err => console.log('money tab spent error', err));
    return () => {
      cancelled = true;
    };
  }, [txsHashKey, sparkInformation.identityPubKey]);

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
        <View style={styles.header}>
          <PageTitle text={t('money.title')} />
        </View>
        <CustomScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: bottomPadding + TAB_ITEM_HEIGHT + 40,
          }}
        >
          <SpentCard
            dailySpent={dailySpent}
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
                trailing={
                  row.value ? (
                    <ThemeText
                      content={row.value}
                      CustomNumberOfLines={1}
                      styles={[styles.rowValue, { color: tokens.muted }]}
                    />
                  ) : undefined
                }
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
    marginTop: 10,
    marginBottom: 20,
    minHeight: 45,
    justifyContent: 'center',
  },
  spentCard: { borderRadius: 24, padding: 20 },
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
  hiddenAmount: { fontFamily: FONT.Asterisk, fontSize: 24 },
  chart: { marginTop: 20 },
  axis: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: { fontSize: 12, lineHeight: 18, includeFontPadding: false },
  rowsCard: { marginTop: 12 },
  rowTitle: { fontSize: 15, lineHeight: 22 },
  rowValue: { fontSize: 14, lineHeight: 21, marginRight: 4 },
});
