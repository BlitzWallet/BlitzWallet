import { ThemeText } from '../../functions/CustomElements';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GetThemeColors from '../../hooks/themeColors';
import { BLITZ_GOAL_USER_COUNT, CENTER, COLORS, SIZES } from '../../constants';
import DateCountdown from '../../components/admin/homeComponents/explore/dateCountdown';
import {
  DAY_IN_MILLS,
  MONTH_GROUPING,
  MONTH_IN_MILLS,
  WEEK_IN_MILLS,
  WEEK_OPTIONS,
  YEAR_IN_MILLS,
} from '../../components/admin/homeComponents/explore/constants';
import {
  formatBalanceAmount,
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../functions';
import { useGlobalContextProvider } from '../../../context-store/context';
import NoDataView from '../../components/admin/homeComponents/explore/noDataView';
import { FONT, INSET_WINDOW_WIDTH } from '../../constants/theme';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-wagmi-charts';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import fetchBackend from '../../../db/handleBackend';
import { useKeysContext } from '../../../context-store/keys';
import { useServerTimeOnly } from '../../../context-store/serverTime';
import {
  formatLocalTimeNumericMonthDay,
  getNoonChicagoUtcMs,
} from '../../functions/timeFormatter';
import { useAppStatus } from '../../../context-store/appStatus';

export default function ExploreUsers() {
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const [timeFrame, setTimeFrame] = useState('day');
  const [isLoading, setIsLoading] = useState(true);
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const { screenDimensions } = useAppStatus();
  const dataObject = masterInfoObject.exploreData
    ? JSON.parse(JSON.stringify(masterInfoObject.exploreData))
    : false;
  const data = dataObject ? dataObject[timeFrame].reverse() : [];
  const getServerTime = useServerTimeOnly();
  const currentTime = getServerTime();
  // const currentTimeZoneOffsetInHours = -6;

  const formattedCurrentTime = useMemo(() => {
    // const targetTimezoneMs =
    //   currentTime + currentTimeZoneOffsetInHours * 60 * 60 * 1000;
    // const targetDate = new Date(targetTimezoneMs);
    // targetDate.setUTCHours(12, 0, 0, 0); // Set to 12pm of the current day

    // return targetDate.getTime();
    // Real UTC ms of 12:00 PM America/Chicago today — used as the chart
    // date reference. DST-aware: CDT (UTC-5) and CST (UTC-6) are handled
    // automatically by getNoonChicagoUtcMs via the IANA tz database.
    return getNoonChicagoUtcMs(currentTime);
  }, [currentTime]);

  const min = data.reduce((prev, current) => {
    if (current?.value < prev) return current.value;
    else return prev;
  }, BLITZ_GOAL_USER_COUNT);

  const max = data.reduce((prev, current) => {
    if (current?.value > prev) return current.value;
    else return prev;
  }, 0);

  const totalYesterday = masterInfoObject.exploreData?.['day']?.[1]?.value || 0;

  const timeFrameElements = useMemo(() => {
    return ['day', 'week', 'month', 'year'].map(item => {
      return (
        <TouchableOpacity
          key={item}
          onPress={() => setTimeFrame(item)}
          style={{
            backgroundColor:
              item === timeFrame
                ? theme && darkModeType
                  ? COLORS.darkModeText
                  : COLORS.primary
                : 'transparent',
            borderColor:
              theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
            ...styles.timeFrameElement,
          }}
        >
          <ThemeText
            styles={{
              color:
                item === timeFrame
                  ? theme && darkModeType
                    ? COLORS.lightModeText
                    : COLORS.darkModeText
                  : textColor,
              ...styles.timeFrameElementText,
            }}
            content={t(`constants.${item}`)}
          />
        </TouchableOpacity>
      );
    });
  }, [timeFrame, textColor, theme, darkModeType]);

  const xLabels = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map((_, index) => {
      if (timeFrame === 'year') {
        const now = formattedCurrentTime;
        return `${new Date(
          now - YEAR_IN_MILLS * Math.abs(6 - index),
        ).getFullYear()}`;
      } else if (timeFrame === 'month') {
        const now = formattedCurrentTime;
        const dateIndex = new Date(
          now - MONTH_IN_MILLS * Math.abs(6 - index),
        ).getMonth();
        return t(`months.${MONTH_GROUPING[dateIndex]}`).slice(0, 3);
      } else if (timeFrame === 'day') {
        const now = formattedCurrentTime - DAY_IN_MILLS;
        const dateIndex = new Date(
          now - DAY_IN_MILLS * Math.abs(7 - index),
        ).getDay();
        return t(`weekdays.${WEEK_OPTIONS[dateIndex]}`).slice(0, 3);
      } else {
        const now = new Date(formattedCurrentTime);
        const todayDay = now.getDay();
        const daysToSunday = 7 - (todayDay === 0 ? 7 : todayDay);
        const endOfWeek = new Date(now.getTime() + daysToSunday * DAY_IN_MILLS);
        const dateIndex = new Date(
          endOfWeek - WEEK_IN_MILLS * Math.abs(6 - index),
        );
        return formatLocalTimeNumericMonthDay(dateIndex);
      }
    });
  }, [timeFrame, t, formattedCurrentTime]);

  const chartData = data.map((d, i) => ({
    timestamp: i * 1000,
    value: d.value,
  }));

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
          getLocalStorageItem('savedExploreData').then(data =>
            JSON.parse(data),
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

  if (isLoading) {
    return <FullLoadingScreen />;
  }

  if (
    !masterInfoObject.exploreData ||
    !Object.keys(masterInfoObject.exploreData).length
  ) {
    return <NoDataView />;
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollView}
    >
      <ThemeText
        styles={styles.statsCardHeader}
        content={t('screens.inAccount.explorePage.title')}
      />

      {/* Today's Stats Card */}
      <View style={{ ...styles.todayCard, backgroundColor: backgroundOffset }}>
        <View style={styles.cardHeader}>
          <ThemeText
            CustomNumberOfLines={1}
            styles={{ ...styles.cardLabel, color: textColor }}
            content={t('constants.today')}
          />
          <DateCountdown
            // currentTimeZoneOffsetInHours={currentTimeZoneOffsetInHours}
            getServerTime={getServerTime}
          />
        </View>

        <ThemeText
          styles={{ ...styles.mainNumber, color: textColor }}
          content={formatBalanceAmount(max, undefined, masterInfoObject)}
        />

        <ThemeText
          styles={{ ...styles.subText, color: textColor }}
          content={t('screens.inAccount.explorePage.goalUserCount', {
            goalUserCount: formatBalanceAmount(
              BLITZ_GOAL_USER_COUNT,
              undefined,
              masterInfoObject,
            ),
          })}
        />

        {/* Progress Bar */}
        <View
          style={{
            backgroundColor: backgroundColor,
            ...styles.progressBarContainer,
          }}
        >
          <View
            style={{
              width: `${(max / BLITZ_GOAL_USER_COUNT) * 100}%`,
              backgroundColor:
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              ...styles.progressBarFill,
            }}
          />
        </View>

        <ThemeText
          styles={{ ...styles.percentageText, color: textColor }}
          content={t('screens.inAccount.explorePage.percentOfGoal', {
            goalPercent: ((max / BLITZ_GOAL_USER_COUNT) * 100).toFixed(2),
          })}
        />
      </View>

      {/* Growth Indicator */}
      <View style={styles.growthIndicator}>
        <ThemeText
          styles={{ ...styles.growthText, color: textColor }}
          content={t('screens.inAccount.explorePage.numAddedUsers', {
            numNewUsers: formatBalanceAmount(
              max - totalYesterday,
              false,
              masterInfoObject,
            ),
          })}
        />
      </View>

      {/* Chart */}
      <LineChart.Provider
        yGutter={0}
        style={{ marginBottom: -20 }}
        data={chartData}
        yRange={{
          min: Math.round(min * 0.95),
          max: Math.round(max * (timeFrame !== 'day' ? 1.2 : 1.05)),
        }}
      >
        <LineChart height={200} width={screenDimensions.width * 0.85}>
          <LineChart.Path
            color={theme && darkModeType ? COLORS.darkModeText : COLORS.primary}
          >
            <LineChart.Gradient
              color={
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary
              }
            />
          </LineChart.Path>
          <LineChart.CursorCrosshair
            color={theme && darkModeType ? COLORS.darkModeText : COLORS.primary}
          >
            <LineChart.Tooltip
              textStyle={{
                color: textColor,
                fontFamily: FONT.Title_Regular,
                fontSize: SIZES.medium,
              }}
              format={({ value }) => {
                'worklet';
                const formattedPrice = Math.round(value);
                return String(formattedPrice);
              }}
            />
          </LineChart.CursorCrosshair>
        </LineChart>
      </LineChart.Provider>

      {/* X-axis labels */}
      <View style={styles.xLabelsRow}>
        {xLabels.map((label, i) => (
          <Text key={i} style={[styles.xLabel, { color: textColor }]}>
            {label}
          </Text>
        ))}
      </View>

      {/* Time Frame Buttons */}
      <View style={styles.timeFrameElementsContainer}>{timeFrameElements}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    width: INSET_WINDOW_WIDTH,
    paddingTop: 20,
    ...CENTER,
  },
  statsCardHeader: {
    marginBottom: 12,
    textAlign: 'center',
  },
  todayCard: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  cardLabel: {
    fontSize: SIZES.small,
    opacity: 0.7,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  mainNumber: {
    fontSize: SIZES.xxLarge,
    // fontWeight: '500',
    // marginBottom: 12,
    includeFontPadding: false,
  },
  subText: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    marginBottom: 16,
    includeFontPadding: false,
  },
  progressBarContainer: {
    height: 25,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 15,
  },
  percentageText: {
    fontSize: SIZES.smedium,
    textAlign: 'center',
    includeFontPadding: false,
  },
  growthIndicator: {
    alignItems: 'center',
    // paddingVertical: 8,
  },
  growthText: {
    fontSize: SIZES.smedium,
    // fontWeight: '500',
    opacity: 0.7,
    includeFontPadding: false,
  },

  xLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  xLabel: {
    fontSize: SIZES.small,
    opacity: 0.6,
    fontFamily: FONT.Title_Regular,
  },
  timeFrameElementsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'center',
    width: '100%',
    rowGap: 10,
    columnGap: 10,
    flexWrap: 'wrap',
    ...CENTER,
  },
  timeFrameElement: {
    flexGrow: 1,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeFrameElementText: {
    textTransform: 'capitalize',
    includeFontPadding: false,
    padding: 10,
  },
});
