import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Stop } from 'react-native-svg';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import { BLITZ_GOAL_USER_COUNT, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import { FONT, SIZES } from '../../constants/theme';
import {
  DAY_IN_MILLS,
  MONTH_GROUPING,
  MONTH_IN_MILLS,
  WEEK_IN_MILLS,
  WEEK_OPTIONS,
  YEAR_IN_MILLS,
} from '../../components/admin/homeComponents/explore/constants';
import {
  formatLocalTimeNumericMonthDay,
  getNoonChicagoUtcMs,
} from '../../functions/timeFormatter';
import {
  formatBalanceAmount,
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../functions';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useTheme } from '../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-wagmi-charts';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import fetchBackend from '../../../db/handleBackend';
import { useKeysContext } from '../../../context-store/keys';
import { useServerTimeOnly } from '../../../context-store/serverTime';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import ProgressBar from '../../functions/CustomElements/redesign/ProgressBar';
import Segmented from '../../functions/CustomElements/redesign/Segmented';
import EmptyState from '../../functions/CustomElements/redesign/EmptyState';

const TIME_FRAMES = ['day', 'week', 'month', 'year'];

export default function ExploreUsers() {
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const [timeFrame, setTimeFrame] = useState('day');
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const dataObject = masterInfoObject.exploreData
    ? JSON.parse(JSON.stringify(masterInfoObject.exploreData))
    : false;
  const data = dataObject ? dataObject[timeFrame].reverse() : [];
  const getServerTime = useServerTimeOnly();
  const currentTime = getServerTime();

  const min = data.reduce((prev, current) => {
    if (current?.value < prev) return current.value;
    else return prev;
  }, BLITZ_GOAL_USER_COUNT);

  const max = data.reduce((prev, current) => {
    if (current?.value > prev) return current.value;
    else return prev;
  }, 0);

  const totalYesterday = masterInfoObject.exploreData?.['day']?.[1]?.value || 0;

  const chartData = data.map((d, i) => ({
    timestamp: i * 1000,
    value: d.value,
  }));

  const yRange = {
    min: Math.round(min * 0.95),
    max: Math.round(max * (timeFrame !== 'day' ? 1.2 : 1.05)),
  };

  useEffect(() => {
    let mounted = true;

    async function loadExploreData() {
      try {
        const [freshExploreData, pastExploreData] = await Promise.all([
          fetchBackend(
            'getTotalUserCount',
            { data: publicKey },
            contactsPrivateKey,
            publicKey,
          ),
          getLocalStorageItem('savedExploreData').then(stored =>
            JSON.parse(stored),
          ),
        ]);

        if (freshExploreData) {
          if (!mounted) return;
          toggleMasterInfoObject({ exploreData: freshExploreData });
          await setLocalStorageItem(
            'savedExploreData',
            JSON.stringify({
              lastUpdated: currentTime,
              data: freshExploreData,
            }),
          );
        } else if (pastExploreData?.data) {
          if (!mounted) return;
          toggleMasterInfoObject({ exploreData: pastExploreData.data });
        }
      } catch (err) {
        console.log(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadExploreData();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRetry = useCallback(async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      const response = await fetchBackend(
        'getTotalUserCount',
        { data: publicKey },
        contactsPrivateKey,
        publicKey,
      );

      toggleMasterInfoObject({ exploreData: response });

      setLocalStorageItem(
        'savedExploreData',
        JSON.stringify({ lastUpdated: new Date().getTime(), data: response }),
      );
    } catch (err) {
      console.log('handling explore users search err', err);
    } finally {
      setIsRetrying(false);
    }
  }, [contactsPrivateKey, isRetrying, publicKey, toggleMasterInfoObject]);

  const xLabels = useMemo(() => {
    // Real UTC ms of noon America/Chicago today (DST-aware) as the chart's date reference.
    const noon = getNoonChicagoUtcMs(currentTime);
    return [0, 1, 2, 3, 4, 5, 6].map(index => {
      if (timeFrame === 'year') {
        return `${new Date(
          noon - YEAR_IN_MILLS * Math.abs(6 - index),
        ).getFullYear()}`;
      }
      if (timeFrame === 'month') {
        const dateIndex = new Date(
          noon - MONTH_IN_MILLS * Math.abs(6 - index),
        ).getMonth();
        return t(`months.${MONTH_GROUPING[dateIndex]}`).slice(0, 3);
      }
      if (timeFrame === 'day') {
        const dateIndex = new Date(
          noon - DAY_IN_MILLS - DAY_IN_MILLS * Math.abs(7 - index),
        ).getDay();
        return t(`weekdays.${WEEK_OPTIONS[dateIndex]}`).slice(0, 3);
      }
      const now = new Date(noon);
      const todayDay = now.getDay();
      const daysToSunday = 7 - (todayDay === 0 ? 7 : todayDay);
      const endOfWeek = new Date(now.getTime() + daysToSunday * DAY_IN_MILLS);
      return formatLocalTimeNumericMonthDay(
        new Date(endOfWeek - WEEK_IN_MILLS * Math.abs(6 - index)),
      );
    });
  }, [timeFrame, t, currentTime]);

  const timeFrameOptions = useMemo(
    () =>
      TIME_FRAMES.map(value => ({
        value,
        label: t(`constants.${value}`),
      })),
    [t],
  );

  const rawGoalPercent = (max / BLITZ_GOAL_USER_COUNT) * 100;
  const goalPercent =
    rawGoalPercent < 10
      ? rawGoalPercent.toFixed(1)
      : String(Math.floor(rawGoalPercent));

  const hasData =
    !!masterInfoObject.exploreData &&
    !!Object.keys(masterInfoObject.exploreData).length;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar title={t('screens.inAccount.settingsContent.blitz stats')} />
        {isLoading ? (
          <FullLoadingScreen />
        ) : !hasData ? (
          <View style={styles.empty}>
            <EmptyState
              icon="ChartArea"
              title={t('errormessages.explorePagenoDataError')}
              onRetry={handleRetry}
            />
          </View>
        ) : (
          <CustomScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <ThemeText
              content={t('screens.inAccount.explorePage.title')}
              styles={[styles.label, { color: tokens.muted }]}
            />
            <ThemeText
              content={formatBalanceAmount(max, undefined, masterInfoObject)}
              CustomNumberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              styles={[styles.heroAmount, { color: tokens.ink }]}
            />
            <ThemeText
              content={`${t('screens.inAccount.explorePage.goalUserCount', {
                goalUserCount: formatBalanceAmount(
                  BLITZ_GOAL_USER_COUNT,
                  undefined,
                  masterInfoObject,
                ),
              })} · ${t('screens.inAccount.explorePage.percentOfGoal', {
                goalPercent,
              })}`}
              styles={[styles.goal, { color: tokens.muted }]}
            />
            <ProgressBar
              value={max / BLITZ_GOAL_USER_COUNT}
              style={styles.progress}
            />
            <ThemeText
              content={t('screens.inAccount.explorePage.numAddedUsers', {
                numNewUsers: formatBalanceAmount(
                  max - totalYesterday,
                  false,
                  masterInfoObject,
                ),
              })}
              styles={styles.today}
            />

            <View
              style={[styles.chartCard, { backgroundColor: tokens.surface }]}
              onLayout={event => setChartWidth(event.nativeEvent.layout.width)}
              accessible
              accessibilityRole="image"
              accessibilityLabel={t('screens.inAccount.explorePage.chartA11y', {
                period: t(`constants.${timeFrame}`),
              })}
            >
              {chartWidth > 0 && (
                <Animated.View key={timeFrame} entering={FadeIn.duration(200)}>
                  <LineChart.Provider
                    yGutter={0}
                    data={chartData}
                    yRange={yRange}
                  >
                    {/* wagmi reserves 40 pt for x-axis labels inside `height`;
                        draw 178 + 40 and pull the empty strip back out. */}
                    <LineChart
                      height={178 + 40}
                      width={chartWidth}
                      style={{ marginBottom: -40 }}
                    >
                      <LineChart.Path color={tokens.accent}>
                        <LineChart.Gradient color={tokens.accent}>
                          <Stop
                            offset="0%"
                            stopColor={tokens.accent}
                            stopOpacity={0.1}
                          />
                          <Stop
                            offset="100%"
                            stopColor={tokens.accent}
                            stopOpacity={0.1}
                          />
                        </LineChart.Gradient>
                      </LineChart.Path>
                      <LineChart.CursorCrosshair color={tokens.accent}>
                        <LineChart.Tooltip
                          textStyle={{
                            color: tokens.ink,
                            fontFamily: FONT.Title_Regular,
                            fontSize: SIZES.medium,
                          }}
                          format={({ value }) => {
                            'worklet';
                            return String(Math.round(value));
                          }}
                        />
                      </LineChart.CursorCrosshair>
                    </LineChart>
                  </LineChart.Provider>
                </Animated.View>
              )}
            </View>

            <View style={styles.xLabelsRow}>
              {xLabels.map((label, i) => (
                <Text key={i} style={[styles.xLabel, { color: tokens.muted }]}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.segmented}>
              <Segmented
                options={timeFrameOptions}
                value={timeFrame}
                onChange={setTimeFrame}
                accessibilityLabel={t('screens.inAccount.explorePage.title')}
              />
            </View>
          </CustomScrollView>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: 'center',
    flex: 1,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
    marginTop: 16,
  },
  heroAmount: {
    fontFamily: FONT.Title_Medium,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    fontSize: 48,
    letterSpacing: -(48 * 0.035),
    textAlign: 'center',
    flexShrink: 1,
  },
  goal: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
  },
  progress: { marginTop: 12, marginHorizontal: 24 },
  today: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
    marginTop: 10,
  },
  segmented: { marginTop: 12 },
  xLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  xLabel: {
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },
  chartCard: {
    marginTop: 20,
    borderRadius: 20,
    paddingTop: 16,
    overflow: 'hidden',
  },
});
