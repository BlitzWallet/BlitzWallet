import {ThemeText} from '../../functions/CustomElements';
import React, {useMemo, useState} from 'react';
import {LineChart, XAxis, YAxis} from 'react-native-svg-charts';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GetThemeColors from '../../hooks/themeColors';
import {BLITZ_GOAL_USER_COUNT, CENTER, COLORS, SIZES} from '../../constants';
import DateCountdown from '../../components/admin/homeComponents/explore/dateCountdown';
import {
  DAY_IN_MILLS,
  MONTH_GROUPING,
  MONTH_IN_MILLS,
  WEEK_IN_MILLS,
  WEEK_OPTIONS,
  YEAR_IN_MILLS,
} from '../../components/admin/homeComponents/explore/constants';
import {formatBalanceAmount} from '../../functions';
import {useGlobalContextProvider} from '../../../context-store/context';
import NoDataView from '../../components/admin/homeComponents/explore/noDataView';
import Grid from '../../functions/CustomElements/chart/grid';
import {FONT, INSET_WINDOW_WIDTH} from '../../constants/theme';
import {useGlobalThemeContext} from '../../../context-store/theme';
import LineChartDot from '../../functions/CustomElements/chart/lineChartDot';
import {findLargestByVisualWidth} from '../../components/admin/homeComponents/explore/largestNumber';
import {useTranslation} from 'react-i18next';

export default function ExploreUsers() {
  const [timeFrame, setTimeFrame] = useState('day');
  const {masterInfoObject} = useGlobalContextProvider();
  const {backgroundOffset, textColor, backgroundColor} = GetThemeColors();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {t} = useTranslation();
  const [targetUserCountBarWidth, setTargetUserCountBarWidth] = useState(0);
  const [yAxisWidth, setYAxisWidth] = useState(0);
  const dataObject = JSON.parse(JSON.stringify(masterInfoObject.exploreData));
  const data = dataObject ? dataObject[timeFrame].reverse() : [];

  const min = data.reduce((prev, current) => {
    console.log(prev, current);
    if (current?.value < prev) return current.value;
    else return prev;
  }, BLITZ_GOAL_USER_COUNT);

  const max = data.reduce((prev, current) => {
    console.log(prev, current);
    if (current?.value > prev) return current.value;
    else return prev;
  }, 0);

  const totalYesterday = masterInfoObject.exploreData?.['day']?.[1]?.value || 0;

  const axesSvg = {
    fontSize: SIZES.small,
    fill: textColor,
    fontFamily: FONT.Title_Regular,
  };
  const verticalContentInset = {top: 10, bottom: 10};
  const xAxisHeight = 30;

  const largestNumber = useMemo(() => {
    return findLargestByVisualWidth(
      Math.round(min * 0.95),
      Math.round(max * 1.05),
      7,
    );
  }, [min, max]);

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
          }}>
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
            content={t(`settings.blitzstats.${item}`)}
          />
        </TouchableOpacity>
      );
    });
  }, [timeFrame, textColor, theme, darkModeType]);

  const XaxisElement = useMemo(() => {
    return (
      <XAxis
        style={{
          height: xAxisHeight,
          // position: 'abolute',
        }}
        data={[0, 1, 2, 3, 4, 5, 6].map((_, index) => index)}
        formatLabel={(value, index) => {
          if (timeFrame === 'year') {
            const now = new Date().getTime();
            return `${new Date(
              now - YEAR_IN_MILLS * Math.abs(6 - index),
            ).getFullYear()}`;
          } else if (timeFrame === 'month') {
            const now = new Date().getTime();
            const dateIndex = new Date(
              now - MONTH_IN_MILLS * Math.abs(6 - index),
            ).getMonth();
            return t(`months.${MONTH_GROUPING[dateIndex]}`).slice(0, 3);
          } else if (timeFrame === 'day') {
            const now = new Date().getTime() - DAY_IN_MILLS;
            const dateIndex = new Date(
              now - DAY_IN_MILLS * Math.abs(7 - index),
            ).getDay();
            return t(`weekdays.${WEEK_OPTIONS[dateIndex]}`).slice(0, 3);
          } else {
            const now = new Date();
            const todayDay = now.getDay();

            const daysToSunday = 7 - (todayDay === 0 ? 7 : todayDay);

            const endOfWeek = new Date(
              now.getTime() + daysToSunday * DAY_IN_MILLS,
            );

            const dateIndex = new Date(
              endOfWeek - WEEK_IN_MILLS * Math.abs(6 - index),
            );
            const day = dateIndex.getDate();
            const month = dateIndex.getMonth() + 1;
            return `${month}/${day}`;
          }
        }}
        contentInset={{left: 15, right: 15}}
        svg={{
          ...axesSvg,
          rotation: 0,
          origin: 0,
          y: 0,
        }}
      />
    );
  }, [timeFrame]);

  if (
    !masterInfoObject.exploreData ||
    !Object.keys(masterInfoObject.exploreData).length
  ) {
    return <NoDataView />;
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollView}>
      <Text
        onLayout={event => {
          console.log(event.nativeEvent.layout.width);
          setYAxisWidth(Math.round(event.nativeEvent.layout.width));
        }}
        style={styles.sizingText}>
        {largestNumber}
      </Text>
      <View style={{...styles.statsCard, backgroundColor: backgroundOffset}}>
        <ThemeText
          styles={styles.statsCardHeader}
          content={t('settings.blitzstats.text1')}
        />
        <ThemeText
          styles={{marginBottom: 5}}
          content={t('settings.blitzstats.text2')}
        />
        <View style={styles.statsCardHorizontal}>
          <DateCountdown />
          <ThemeText
            styles={styles.statsCardNumberText}
            content={`${formatBalanceAmount(max)} of ${formatBalanceAmount(
              BLITZ_GOAL_USER_COUNT,
            )} (${((max / BLITZ_GOAL_USER_COUNT) * 100).toFixed(4)}%)`}
          />
        </View>
        <View
          onLayout={event => {
            setTargetUserCountBarWidth(event.nativeEvent.layout.width);
          }}
          style={{
            backgroundColor: backgroundColor,
            ...styles.statsCardBar,
          }}>
          <View
            style={{
              width: targetUserCountBarWidth * (max / BLITZ_GOAL_USER_COUNT),
              backgroundColor:
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              ...styles.statsCardBarFill,
            }}
          />
        </View>
        <View style={styles.statsCardHorizontal}>
          <ThemeText content={t('settings.blitzstats.text3')} />
          <ThemeText
            styles={styles.statsCardNumberText}
            content={`${formatBalanceAmount(
              totalYesterday,
            )} of ${formatBalanceAmount(BLITZ_GOAL_USER_COUNT)} (${(
              (totalYesterday / BLITZ_GOAL_USER_COUNT) *
              100
            ).toFixed(4)}%)`}
          />
        </View>
      </View>

      <View style={styles.chartContainer}>
        <YAxis
          data={data.map(data => data.value)}
          style={{
            marginBottom: xAxisHeight,
            width: yAxisWidth + 5,
          }}
          contentInset={verticalContentInset}
          svg={axesSvg}
          min={Math.round(min * 0.95)}
          max={Math.round(max * (timeFrame !== 'day' ? 1.2 : 1.05))}
          numberOfTicks={7}
        />
        <View style={{flex: 1, marginLeft: 5}}>
          <LineChart
            style={{flex: 1}}
            data={data.map(data => data.value)}
            contentInset={{...verticalContentInset, left: 10, right: 10}}
            svg={{
              stroke:
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              strokeWidth: 3,
            }}
            yMin={Math.round(min * 0.95)}
            yMax={Math.round(max * (timeFrame !== 'day' ? 1.2 : 1.05))}>
            <Grid />
            <LineChartDot
              color={
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary
              }
            />
          </LineChart>
          {XaxisElement}
        </View>
      </View>
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
  statsCard: {borderRadius: 8, padding: 10},
  statsCardHeader: {
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    marginBottom: 5,
  },
  statsCardHorizontal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsCardBar: {
    height: 30,
    width: '100%',
    borderRadius: 25,
    marginVertical: 10,
    overflow: 'hidden',
  },
  statsCardBarFill: {
    height: '100%',
    marginRight: 'auto',
  },
  statsCardNumberText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  chartContainer: {
    height: 250,
    flexDirection: 'row',
    marginTop: 20,
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
  sizingText: {
    fontSize: SIZES.small,
    fontFamily: FONT.Title_Regular,
    position: 'absolute',
    zIndex: -1,
    opacity: 0,
  },
});
