import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import React, {useMemo, useState, useEffect} from 'react';
import {Grid, LineChart, XAxis, YAxis} from 'react-native-svg-charts';
import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import GetThemeColors from '../../hooks/themeColors';
import {
  BLITZ_GOAL_USER_COUNT,
  CENTER,
  COLORS,
  ICONS,
  SIZES,
} from '../../constants';
import {Circle} from 'react-native-svg';
import DateCountdown from '../../components/admin/homeComponents/explore/dateCountdown';
import {
  MONTH_GROUPING,
  WEEK_OPTIONS,
} from '../../components/admin/homeComponents/explore/constants';
import ThemeImage from '../../functions/CustomElements/themeImage';
import {INSET_WINDOW_WIDTH} from '../../constants/theme';
import {formatBalanceAmount} from '../../functions';
const Decorator = ({x, y, data}) => {
  return data.map((value, index) => (
    <Circle
      key={index}
      cx={x(index)}
      cy={y(value)}
      r={3}
      stroke={COLORS.primary}
      strokeWidth={1}
      fill={'white'}
    />
  ));
};
export default function ExploreUsers() {
  const [timeFrame, setTimeFrame] = useState('day');
  const {backgroundOffset, textColor} = GetThemeColors();
  const data = [
    {date: 1744070400000, value: 998},
    {date: 1744170400000, value: 1020},
    {date: 1744270400000, value: 1037},
    {date: 1744370400000, value: 1041},
    {date: 1744470400000, value: 0},
    {date: 1744570400000, value: 0},
    {date: 1744670400000, value: 0},
  ];
  const [targetUserCountBarWidth, setTargetUserCountBarWidth] = useState(0);

  const axesSvg = {fontSize: SIZES.small, fill: textColor};
  const verticalContentInset = {top: 10, bottom: 10};
  const [xAxisHeight, setXAxisHeight] = useState(30);

  const timeFrameElements = useMemo(() => {
    return ['day', 'week', 'month', 'year'].map(item => {
      return (
        <TouchableOpacity
          onPress={() => setTimeFrame(item)}
          style={{
            borderRadius: 8,
            borderColor: COLORS.primary,
            backgroundColor:
              item === timeFrame ? COLORS.primary : 'transparent',
            borderWidth: 2,
          }}>
          <ThemeText
            styles={{
              color: item === timeFrame ? COLORS.darkModeText : textColor,
              textTransform: 'capitalize',
              padding: 10,
            }}
            content={item === 'day' ? 'Daily' : `${item}ly`}
          />
        </TouchableOpacity>
      );
    });
  }, [timeFrame, textColor]);

  const XaxisElement = useMemo(() => {
    return (
      <XAxis
        style={{height: xAxisHeight, position: 'abolute'}}
        data={data.map((_, index) => index)}
        formatLabel={(value, index) => {
          if (timeFrame === 'year') {
            const YEAR_IN_MILLS = 1000 * 60 * 60 * 24 * 365;
            const now = new Date().getTime();
            return `${new Date(
              now - YEAR_IN_MILLS * Math.abs(6 - index),
            ).getFullYear()}`;
          } else if (timeFrame === 'month') {
            const MONTH_IN_MILLS = 1000 * 60 * 60 * 24 * 31;
            const now = new Date().getTime();
            const dateIndex = new Date(
              now - MONTH_IN_MILLS * Math.abs(6 - index),
            ).getMonth();
            return [
              'Jan',
              'Feb',
              'Mar',
              'Apr',
              'May',
              'Jun',
              'Jul',
              'Aug',
              'Sep',
              'Oct',
              'Nov',
              'Dec',
            ][dateIndex];
          } else if (timeFrame === 'day') {
            const DAY_IN_MILLS = 1000 * 60 * 60 * 24;
            const now = new Date().getTime();
            const dateIndex = new Date(
              now - DAY_IN_MILLS * Math.abs(6 - index),
            ).getDay();
            return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dateIndex];
          } else {
            const WEEK_IN_MILLS = 1000 * 60 * 60 * 24 * 7;
            const now = new Date().getTime();
            const dateIndex = new Date(
              now - WEEK_IN_MILLS * Math.abs(6 - index),
            );
            const day = dateIndex.getDate();
            const month = dateIndex.getMonth();

            return `${MONTH_GROUPING[month]} ${day}`;
          }
        }}
        contentInset={{left: 15, right: 15}}
        svg={{
          ...axesSvg,
          rotation: timeFrame === 'week' ? -30 : 0,
          origin: timeFrame === 'week' ? 15 : 0,
          y: timeFrame === 'week' ? 10 : 0,
        }}
      />
    );
  }, [timeFrame, xAxisHeight]);

  useEffect(() => {
    const labelFontSize = SIZES.small;
    const labelRotation = 45;
    let longestLabel = '';

    if (timeFrame === 'month') {
      longestLabel = 'Jan';
    } else if (timeFrame === 'day') {
      longestLabel = 'Mon';
    } else if (timeFrame === 'week') {
      longestLabel = 'Mon 21';
    } else {
      longestLabel = '2024';
    }

    const averageCharWidth = labelFontSize * 0.6;
    const labelPixelLength = longestLabel.length * averageCharWidth;
    const estimatedHeight =
      Math.sin((labelRotation * Math.PI) / 180) * labelPixelLength + 10;

    setXAxisHeight(timeFrame !== 'week' ? 30 : estimatedHeight + 15);
  }, [timeFrame]);

  return (
    <GlobalThemeView useStandardWidth={true} styles={{paddingBottom: 0}}>
      <ThemeText content={'Explore'} styles={{...styles.headerText}} />
      <ScrollView
        contentContainerStyle={{
          width: '95%',
          paddingTop: 20,
          ...CENTER,
        }}>
        <View
          style={{
            backgroundColor: backgroundOffset,
            borderRadius: 8,
            padding: 10,
          }}>
          <ThemeText
            styles={{
              fontSize: SIZES.xLarge,
              textAlign: 'center',
              marginBottom: 5,
            }}
            content={'Blitz Wallet Downloads'}
          />
          <ThemeText styles={{marginBottom: 5}} content={'Today'} />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}>
            <DateCountdown />

            <ThemeText
              styles={{fontSize: 'small'}}
              content={`${formatBalanceAmount(1050)} of ${formatBalanceAmount(
                BLITZ_GOAL_USER_COUNT,
              )} (${(1050 / BLITZ_GOAL_USER_COUNT) * 100}%)`}
            />
          </View>
          <View
            onLayout={event => {
              setTargetUserCountBarWidth(event.nativeEvent.layout.width);
            }}
            style={{
              height: 30,
              width: '100%',
              backgroundColor: COLORS.lightModeBackground,
              borderRadius: 25,
              marginVertical: 10,
              overflow: 'hidden',
            }}>
            <View
              style={{
                width:
                  targetUserCountBarWidth * (10000 / BLITZ_GOAL_USER_COUNT),
                height: '100%',
                backgroundColor: COLORS.primary,
                marginRight: 'auto',
              }}></View>
          </View>
          <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
            <ThemeText content={'Yesterday'} />
            <ThemeText
              styles={{fontSize: 'small'}}
              content={`${formatBalanceAmount(50)} of ${formatBalanceAmount(
                BLITZ_GOAL_USER_COUNT,
              )} (${((50 / BLITZ_GOAL_USER_COUNT) * 100).toFixed(4)}%)`}
            />
          </View>
        </View>

        <View
          style={{
            height: 250,
            flexDirection: 'row',
            marginTop: 20,
          }}>
          <YAxis
            data={data.map(data => data.value)}
            style={{marginBottom: xAxisHeight}}
            contentInset={verticalContentInset}
            svg={axesSvg}
          />
          <View style={{flex: 1, marginLeft: 5}}>
            <LineChart
              style={{flex: 1}}
              data={data.map(data => data.value)}
              contentInset={{...verticalContentInset, left: 10, right: 10}}
              svg={{stroke: COLORS.primary, strokeWidth: 3}}>
              <Grid />
              <Decorator />
            </LineChart>
            {XaxisElement}
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            width: '90%',
            ...CENTER,
          }}>
          {timeFrameElements}
        </View>
      </ScrollView>
    </GlobalThemeView>
  );
}

function yearElements() {
  const currentYear = new Date().getFullYear();
  const YEAR_OPTIONS = Array.from({length: 7}, (_, i) => currentYear - i);
  return YEAR_OPTIONS.reverse();
}

const styles = StyleSheet.create({
  headerText: {fontSize: SIZES.large, ...CENTER},
});
