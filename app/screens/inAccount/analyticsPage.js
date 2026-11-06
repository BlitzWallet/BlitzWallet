import { useNavigation } from '@react-navigation/native';
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import BalancePieChart from '../../components/admin/homeComponents/analytics/balancePieChart';
import getBudgetStatus from '../../components/admin/homeComponents/analytics/budgetStatus';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../context-store/theme';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../context-store/nodeContext';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import { useAnalytics } from '../../../context-store/analyticsContext';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import Segmented from '../../functions/CustomElements/redesign/Segmented';
import SectionHeader from '../../functions/CustomElements/redesign/SectionHeader';
import Disc from '../../functions/CustomElements/redesign/Disc';
import ProgressBar from '../../functions/CustomElements/redesign/ProgressBar';

export default function AnalyticsPage() {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { bottomPadding } = useGlobalInsets();
  const { tokens } = useGlobalThemeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const {
    spentTotal,
    incomeTotalBTC,
    incomeTotalUSD,
    spentTotalBTC,
    spentTotalUSD,
    incomeTxCountBTC,
    incomeTxCountUSD,
    spentTxCountBTC,
    spentTxCountUSD,
    isLoading,
    isReloading,
  } = useAnalytics();
  const { t } = useTranslation();
  const [localDenomination, setLocalDenomination] = useState('sats');

  const budget = masterInfoObject?.monthlyBudget;
  const budgetAmount = budget?.amount || 0;
  const leftToSpend = Math.max(budgetAmount - spentTotal, 0);
  const spentPercent = budgetAmount > 0 ? spentTotal / budgetAmount : 0;
  const isBalanceHidden =
    masterInfoObject?.userBalanceDenomination === 'hidden';
  const budgetStatus = getBudgetStatus(spentPercent, t, tokens);
  const isSats = localDenomination === 'sats';
  const monthName = new Date().toLocaleDateString(undefined, {
    month: 'long',
  });

  const formatMonthAmount = amount =>
    displayCorrectDenomination({
      amount,
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: localDenomination,
      },
      fiatStats,
      convertAmount: isSats,
      forceCurrency: 'USD',
    });

  const metricCards = [
    {
      key: 'received',
      icon: 'ArrowDown',
      label: t('constants.received'),
      amount: isSats ? incomeTotalBTC : incomeTotalUSD,
      count: isSats ? incomeTxCountBTC : incomeTxCountUSD,
      emptyText: t('analytics.home.noPaymentsReceived'),
      route: 'AnalyticsIncomePage',
    },
    {
      key: 'sent',
      icon: 'ArrowUp',
      label: t('constants.sent'),
      amount: isSats ? spentTotalBTC : spentTotalUSD,
      count: isSats ? spentTxCountBTC : spentTxCountUSD,
      emptyText: t('analytics.home.noPaymentsSent'),
      route: 'AnalyticsSpentPage',
    },
  ];

  return (
    <GlobalThemeView styles={{ paddingBottom: 0 }} useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('analytics.home.title')} />
        {isLoading ? (
          <FullLoadingScreen showText={false} />
        ) : (
          <CustomScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: bottomPadding }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.segmentRow}>
              <Segmented
                fit
                value={localDenomination}
                onChange={setLocalDenomination}
                options={[
                  { value: 'sats', label: t('constants.bitcoin_upper') },
                  { value: 'fiat', label: t('constants.dollars_upper') },
                ]}
              />
            </View>

            <View style={styles.balanceCard}>
              <BalancePieChart isBalanceHidden={isBalanceHidden} />
            </View>

            <SectionHeader title={monthName} style={styles.sectionHeader} />
            <Animated.View
              key={localDenomination}
              entering={FadeIn.duration(200)}
              style={styles.metricsRow}
            >
              {metricCards.map(card => (
                <TouchableOpacity
                  key={card.key}
                  style={[
                    styles.metricCard,
                    { backgroundColor: tokens.surface },
                  ]}
                  onPress={() =>
                    navigate.navigate(card.route, { localDenomination })
                  }
                  activeOpacity={0.8}
                >
                  <View style={styles.metricTop}>
                    <Disc icon={card.icon} size={32} iconSize={16} />
                    <ThemeIcon
                      redesign
                      iconName="ChevronRight"
                      size={18}
                      colorOverride={tokens.muted}
                    />
                  </View>
                  <ThemeText
                    styles={[styles.metricLabel, { color: tokens.muted }]}
                    content={card.label}
                  />
                  {isReloading ? (
                    <FullLoadingScreen size="small" showText={false} />
                  ) : (
                    <>
                      <ThemeText
                        CustomNumberOfLines={1}
                        adjustsFontSizeToFit={true}
                        styles={styles.metricAmount}
                        content={formatMonthAmount(card.amount)}
                      />
                      <ThemeText
                        styles={[styles.metricSub, { color: tokens.muted }]}
                        content={
                          card.count === 0
                            ? card.emptyText
                            : t('analytics.numberOfTxs', { count: card.count })
                        }
                      />
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </Animated.View>

            <SectionHeader
              title={t('analytics.home.budget')}
              style={styles.sectionHeader}
            />
            {!budget ? (
              <TouchableOpacity
                style={[styles.budgetCard, { backgroundColor: tokens.surface }]}
                onPress={() => navigate.navigate('AnalyticsCreateBudgetPage')}
                activeOpacity={0.8}
              >
                <View style={styles.budgetTitleRow}>
                  <View style={styles.budgetTitleTexts}>
                    <ThemeText
                      styles={styles.budgetTitle}
                      content={t('analytics.home.noBudgetTitle')}
                    />
                    <ThemeText
                      styles={[styles.metricSub, { color: tokens.muted }]}
                      content={t('analytics.home.noBudgetSub')}
                    />
                  </View>
                  <ThemeIcon
                    redesign
                    iconName="ChevronRight"
                    size={18}
                    colorOverride={tokens.muted}
                  />
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.budgetCard, { backgroundColor: tokens.surface }]}
                onPress={() => navigate.navigate('AnalyticsBudgetPage')}
                activeOpacity={0.8}
              >
                <View style={styles.budgetTitleRow}>
                  <ThemeText
                    styles={[styles.budgetTitle, styles.budgetTitleTexts]}
                    content={t('analytics.home.leftToSpend', {
                      amount: displayCorrectDenomination({
                        amount: leftToSpend,
                        masterInfoObject,
                        fiatStats,
                      }),
                    })}
                  />
                  <ThemeIcon
                    redesign
                    iconName="ChevronRight"
                    size={18}
                    colorOverride={tokens.muted}
                  />
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: budgetStatus.color },
                  ]}
                >
                  <ThemeText
                    styles={[styles.statusText, { color: tokens.onAccent }]}
                    content={budgetStatus.label}
                  />
                </View>
                <ProgressBar
                  value={spentPercent}
                  color={budgetStatus.color}
                  style={styles.progressBar}
                />
                <View style={styles.progressLabels}>
                  <ThemeText
                    styles={[styles.metricSub, { color: tokens.muted }]}
                    content={t('analytics.home.percentRemaining', {
                      percent: Math.round(
                        Math.min(Math.max(1 - spentPercent, 0) * 100, 100),
                      ),
                    })}
                  />
                  <ThemeText
                    styles={[styles.metricSub, { color: tokens.muted }]}
                    content={t('analytics.home.ofBudget', {
                      amount: displayCorrectDenomination({
                        amount: budgetAmount,
                        masterInfoObject,
                        fiatStats,
                      }),
                    })}
                  />
                </View>
              </TouchableOpacity>
            )}
          </CustomScrollView>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  segmentRow: {
    marginTop: 16,
    alignSelf: 'center',
  },
  balanceCard: { marginTop: 16 },
  sectionHeader: { marginTop: 20 },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 24,
    padding: 16,
    gap: 2,
  },
  metricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metricLabel: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  metricAmount: {
    fontSize: 22,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  metricSub: {
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  budgetCard: {
    borderRadius: 24,
    padding: 20,
  },
  budgetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  budgetTitleTexts: { flexShrink: 1, gap: 2 },
  budgetTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
  },
  progressBar: { marginTop: 14 },
  progressLabels: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 2,
    columnGap: 12,
  },
});
