import { useNavigation } from '@react-navigation/native';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CENTER, FONT, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useAnalytics } from '../../../../../context-store/analyticsContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import ListCard, {
  ListDivider,
} from '../../../../functions/CustomElements/redesign/ListCard';
import ActivityRow, {
  buildActivitySections,
} from '../viewAllComponents/activityRow';

const CHART_HEIGHT = 120;
const MAX_BAR_HEIGHT = 114;
const DASH_HEIGHT = 4;

// Same per-row ListCard pattern as ViewAllTxPage so the list stays virtualised.
const RowSeparator = () => (
  <ListCard style={styles.middleRow}>
    <ListDivider inset={68} />
  </ListCard>
);

function Bar({ height, delay, color, opacity }) {
  const animatedHeight = useSharedValue(0);
  useEffect(() => {
    animatedHeight.value = withDelay(delay, withTiming(height));
  }, [height, delay]);
  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));
  return (
    <Animated.View
      style={[styles.bar, { backgroundColor: color, opacity }, animatedStyle]}
    />
  );
}

// One bar per day: past days muted, today accent, days to come as dashes.
function DailyBars({ cumulativeData }) {
  const { tokens } = useGlobalThemeContext();
  const { t } = useTranslation();
  const now = new Date();
  const todayIndex = now.getDate() - 1;

  const daily = cumulativeData.map((day, index) =>
    index > todayIndex
      ? null
      : day.value - (index ? cumulativeData[index - 1].value : 0),
  );
  const max = Math.max(...daily.filter(value => value !== null), 0);

  const dayLabel = day =>
    new Date(now.getFullYear(), now.getMonth(), day).toLocaleDateString(
      undefined,
      { month: 'short', day: 'numeric' },
    );

  return (
    <>
      <View style={styles.chart}>
        {daily.map((value, index) => {
          const isToday = index === todayIndex;
          if (value === null || (!value && !isToday)) {
            return (
              <View
                key={index}
                style={[
                  styles.bar,
                  { height: DASH_HEIGHT, backgroundColor: tokens.divider },
                ]}
              />
            );
          }
          return (
            <Bar
              key={index}
              delay={index * 30}
              height={Math.max(
                DASH_HEIGHT,
                max ? (value / max) * MAX_BAR_HEIGHT : 0,
              )}
              color={isToday ? tokens.accent : tokens.muted}
              opacity={isToday ? 1 : 0.35}
            />
          );
        })}
      </View>
      <View style={styles.chartLabels}>
        {[dayLabel(1), t('constants.today'), dayLabel(daily.length)].map(
          (label, index) => (
            <ThemeText
              key={index}
              styles={[styles.chartLabel, { color: tokens.muted }]}
              content={label}
            />
          ),
        )}
      </View>
    </>
  );
}

export default function AnalyticsMonthPage(props) {
  const navigate = useNavigation();
  const { localDenomination } = props.route.params || {};
  const isIncome = props.route.name === 'AnalyticsIncomePage';
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation, showTokensInformation } = useSparkWallet();
  const { poolInfoRef, swapLimits } = useFlashnet();
  const { fiatStats } = useNodeContext();
  const { bottomPadding } = useGlobalInsets();
  const { tokens } = useGlobalThemeContext();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const analytics = useAnalytics();

  const isFiat = localDenomination === 'fiat';
  const suffix = isFiat ? 'USD' : 'BTC';
  const txs = analytics[`${isIncome ? 'inTxs' : 'outTxs'}${suffix}`];
  const total = analytics[`${isIncome ? 'incomeTotal' : 'spentTotal'}${suffix}`];
  const cumulativeData =
    analytics[`cumulative${isIncome ? 'Income' : 'Spent'}Data${suffix}`];

  // Flatten the day sections; the day becomes each row's subtitle.
  const rows = useMemo(
    () =>
      buildActivitySections({
        transactions: txs,
        tokens: sparkInformation.tokens,
        enabledLRC20: showTokensInformation,
        t,
      }).flatMap(section =>
        section.data.map(item => ({ ...item, dateLabel: section.title })),
      ),
    [txs, sparkInformation.tokens, showTokensInformation, t],
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <ListCard
        style={[
          index > 0 && styles.squareTop,
          index < rows.length - 1 && styles.squareBottom,
        ]}
      >
        <ActivityRow
          item={item}
          navigate={navigate}
          userBalanceDenomination={localDenomination}
          tokens={sparkInformation.tokens}
          poolInfoRef={poolInfoRef}
          swapLimits={swapLimits}
          sub={item.dateLabel}
        />
      </ListCard>
    ),
    [
      rows.length,
      navigate,
      localDenomination,
      sparkInformation.tokens,
      poolInfoRef,
      swapLimits,
    ],
  );

  const header = (
    <>
      <ThemeText
        styles={[styles.heroLabel, { color: tokens.muted }]}
        content={t('analytics.thisMonth')}
      />
      <ThemeText
        styles={styles.heroAmount}
        CustomNumberOfLines={1}
        adjustsFontSizeToFit={true}
        content={displayCorrectDenomination({
          amount: total,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: localDenomination,
          },
          fiatStats,
          convertAmount: !isFiat,
          forceCurrency: isFiat ? 'USD' : undefined,
        })}
      />
      <DailyBars cumulativeData={cumulativeData} />
      {rows.length ? (
        <SectionHeader title={t('analytics.transactions')} />
      ) : (
        <View style={styles.empty}>
          <EmptyState
            icon={isIncome ? 'ArrowDown' : 'ArrowUp'}
            title={t(
              isIncome
                ? 'analytics.breakdown.noReceivedTitle'
                : 'analytics.breakdown.noSentTitle',
            )}
            sub={t(
              isIncome
                ? 'analytics.breakdown.noReceivedSub'
                : 'analytics.breakdown.noSentSub',
            )}
          />
        </View>
      )}
    </>
  );

  return (
    <GlobalThemeView styles={{ paddingBottom: 0 }} useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t(isIncome ? 'constants.received' : 'constants.sent')}
        />
        {analytics.isLoading ? (
          <FullLoadingScreen showText={false} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={RowSeparator}
            ListHeaderComponent={header}
            contentContainerStyle={{ paddingBottom: bottomPadding }}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={11}
            showsVerticalScrollIndicator={false}
          />
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
  heroLabel: {
    marginTop: 24,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
  },
  heroAmount: {
    fontFamily: FONT.Title_Medium,
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -1.54,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  chart: {
    marginTop: 20,
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
  chartLabels: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartLabel: {
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false,
  },
  empty: { marginTop: 48 },
  squareTop: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  squareBottom: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  middleRow: { borderRadius: 0 },
});
