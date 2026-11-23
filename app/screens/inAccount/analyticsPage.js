import { useNavigation } from '@react-navigation/native';
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import {
  CARD_RADIUS,
  CENTER,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
} from '../../constants';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import AnalyticsKinds from '../../components/admin/homeComponents/analytics/analyticsKinds';
import getBudgetStatus from '../../components/admin/homeComponents/analytics/budgetStatus';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../context-store/theme';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../context-store/nodeContext';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { useAnalyticsNumbers } from '../../../context-store/analyticsContext';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import Skeleton from '../../functions/CustomElements/redesign/Skeleton';
import SkeletonBar from '../../functions/CustomElements/redesign/SkeletonBar';
import SectionHeader from '../../functions/CustomElements/redesign/SectionHeader';
import EmptyState from '../../functions/CustomElements/redesign/EmptyState';
import ProgressBar from '../../functions/CustomElements/redesign/ProgressBar';
import BarChart from '../../functions/CustomElements/redesign/BarChart';
import usePeriodAnalytics from '../../functions/analytics/usePeriodAnalytics';
import formatDate from '../../functions/formatDate';
import buildSpendingChart from '../../functions/analytics/spendingChart';
import { ANALYTICS_TIMEFRAMES } from '../../functions/analytics/periods';
import IconButton from '../../functions/CustomElements/redesign/IconButton';
import { FADE_TOP } from '../../functions/CustomElements/redesign/TopFade';

const CHART_HEIGHT = 120;
// Timeframes with a period before them that is worth comparing against.
const PREVIOUS_PERIOD_LABEL = {
  [ANALYTICS_TIMEFRAMES.TODAY]: 'analytics.chart.yesterday',
  [ANALYTICS_TIMEFRAMES.WEEK]: 'analytics.chart.lastWeek',
  [ANALYTICS_TIMEFRAMES.MONTH]: 'analytics.chart.lastMonth',
  [ANALYTICS_TIMEFRAMES.YEAR]: 'analytics.chart.lastYear',
};

export default function AnalyticsPage() {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { poolInfoRef } = useFlashnet();
  const { bottomPadding } = useGlobalInsets();
  const { tokens } = useGlobalThemeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { t } = useTranslation();
  const { spentTotal, isLoading: isBudgetLoading } = useAnalyticsNumbers();
  const [timeframe, setTimeframe] = useState(ANALYTICS_TIMEFRAMES.MONTH);
  const analytics = usePeriodAnalytics(timeframe);
  // Never sent anything: an empty state instead of a chart of zeros.
  const isEmpty = analytics.hasSpending === false;

  // Total, comparison, kinds and budget follow the global display setting.
  const formatAmount = amount =>
    displayCorrectDenomination({ amount, masterInfoObject, fiatStats });

  const title = t('analytics.chart.titleSpent', {
    period: t(`analytics.chart.period.${timeframe}`),
  });

  const previousLabelKey = PREVIOUS_PERIOD_LABEL[timeframe];
  const contextText = [
    t('analytics.numberOfPayments', { count: analytics.count }),
    previousLabelKey
      ? t('analytics.chart.previousTotal', {
          period: t(previousLabelKey),
          amount: formatAmount(analytics.previousTotal),
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const chart = buildSpendingChart({
    aggregated: analytics,
    priceAInB: poolInfoRef.currentPriceAInB,
    tokens,
    t,
    masterInfoObject,
    fiatStats,
  });

  const openDatePicker = () =>
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'analyticsFilter',
      sliderHight: 0.5,
      timeframe,
      onChange: setTimeframe,
    });

  // The budget always tracks the current month, whatever the chart timeframe.
  const monthName = formatDate(new Date(), 'month');
  const budget = masterInfoObject?.monthlyBudget;
  const budgetAmount = budget?.amount || 0;
  const leftToSpend = Math.max(budgetAmount - spentTotal, 0);
  const spentPercent = budgetAmount > 0 ? spentTotal / budgetAmount : 0;
  const budgetStatus = getBudgetStatus(spentPercent, t, tokens);

  return (
    <GlobalThemeView styles={{ paddingBottom: 0 }} useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          fade
          title={t('analytics.home.title')}
          right={
            !isEmpty && (
              <IconButton icon={'ListFilter'} onPress={openDatePicker} />
            )
          }
        />
        <CustomScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingTop: FADE_TOP,
            paddingBottom: bottomPadding,
          }}
        >
          {isEmpty ? (
            <View style={styles.empty}>
              <EmptyState
                icon="ChartColumn"
                title={t('analytics.breakdown.noSentTitle')}
                sub={t('analytics.breakdown.noSentSub')}
              />
            </View>
          ) : (
            <>
              <View
                style={[styles.heroCard, { backgroundColor: tokens.surface }]}
              >
                <ThemeText
                  content={title}
                  styles={[styles.muted, { color: tokens.muted }]}
                />
                {analytics.isLoading ? (
                  <View style={styles.heroSkeleton}>
                    <SkeletonBar width={190} height={44} borderRadius={12} />
                    <SkeletonBar width={140} height={13} borderRadius={7} />
                  </View>
                ) : (
                  <>
                    <ThemeText
                      CustomNumberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.5}
                      content={formatAmount(analytics.total)}
                      styles={styles.heroAmount}
                    />
                    <ThemeText
                      content={contextText}
                      styles={[styles.muted, { color: tokens.muted }]}
                    />
                  </>
                )}
                <View style={styles.chart}>
                  <BarChart
                    series={analytics.isLoading ? [] : chart.series}
                    labels={analytics.buckets.map(bucket => bucket.label)}
                    legend={analytics.isLoading ? [] : chart.legend}
                    height={CHART_HEIGHT}
                    accessibilityLabel={`${title}. ${formatAmount(
                      analytics.total,
                    )}`}
                  />
                </View>
              </View>

              {analytics.isLoading ? (
                <>
                  <SectionHeader title={t('analytics.kinds.title')} />
                  <View
                    style={[styles.card, { backgroundColor: tokens.surface }]}
                  >
                    <Skeleton>
                      <View style={styles.kindsSkeleton}>
                        <View style={styles.skeletonBar} />
                        <View style={styles.skeletonRow} />
                        <View style={styles.skeletonRow} />
                      </View>
                    </Skeleton>
                  </View>
                </>
              ) : (
                analytics.kinds.length > 0 && (
                  <>
                    <SectionHeader title={t('analytics.kinds.title')} />
                    <AnalyticsKinds
                      kinds={analytics.kinds}
                      formatAmount={formatAmount}
                    />
                  </>
                )
              )}
            </>
          )}

          <SectionHeader
            title={t('analytics.budget.monthBudget', { month: monthName })}
          />
          {budget && isBudgetLoading ? (
            // Left-to-spend and progress need this month's spending.
            <View
              style={[styles.budgetCard, { backgroundColor: tokens.surface }]}
            >
              <Skeleton>
                <View style={styles.budgetSkeleton}>
                  <View style={styles.budgetSkeletonTitle} />
                  <View style={styles.budgetSkeletonPill} />
                  <View style={styles.budgetSkeletonBar} />
                  <View style={styles.budgetSkeletonSub} />
                </View>
              </Skeleton>
            </View>
          ) : !budget ? (
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
                    styles={[styles.muted, { color: tokens.muted }]}
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
                    amount: formatAmount(leftToSpend),
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
                  { backgroundColor: budgetStatus.pillBg },
                ]}
              >
                <ThemeText
                  styles={[styles.statusText, { color: budgetStatus.pillText }]}
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
                  styles={[styles.muted, { color: tokens.muted }]}
                  content={t('analytics.home.percentRemaining', {
                    percent: Math.round(
                      Math.min(Math.max(1 - spentPercent, 0) * 100, 100),
                    ),
                  })}
                />
                <ThemeText
                  styles={[styles.muted, { color: tokens.muted }]}
                  content={t('analytics.home.ofBudget', {
                    amount: formatAmount(budgetAmount),
                  })}
                />
              </View>
            </TouchableOpacity>
          )}
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scroll: { flex: 1 },
  datePill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    flexShrink: 1,
  },
  datePillText: { fontSize: 13, lineHeight: 18, includeFontPadding: false },
  empty: { paddingVertical: 48 },
  heroCard: { marginTop: 8, borderRadius: CARD_RADIUS, padding: 20 },
  heroAmount: {
    marginTop: 2,
    fontFamily: FONT.Title_Medium,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -1.4,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  heroSkeleton: { marginTop: 6, gap: 10 },
  chart: { marginTop: 20 },
  muted: { fontSize: 13, lineHeight: 18, includeFontPadding: false },
  card: { borderRadius: CARD_RADIUS, padding: 20 },
  budgetCard: { borderRadius: CARD_RADIUS, padding: 20 },
  budgetSkeleton: { gap: 12 },
  budgetSkeletonTitle: { width: 180, height: 18, borderRadius: 9 },
  budgetSkeletonPill: { width: 90, height: 24, borderRadius: 12 },
  budgetSkeletonBar: { width: '100%', height: 8, borderRadius: 4 },
  budgetSkeletonSub: { width: 120, height: 12, borderRadius: 6 },
  kindsSkeleton: { gap: 14 },
  skeletonBar: { width: '100%', height: 10, borderRadius: 5 },
  skeletonRow: { width: '100%', height: 18, borderRadius: 6 },
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
