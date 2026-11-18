import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import { useReducedMotion } from '../../../constants/motion';

const STUB_HEIGHT = 4;
const MIN_BAR = 3;
const BAR_STAGGER = 18;
const BAR_DURATION = 320;
// Above this many groups the axis labels are thinned to roughly six.
const MAX_LABELS = 6;
const STUB_SERIES = [{ values: [] }, { values: [] }];

// Grouped bar chart: one bar per series in every interval, no grid or numbers.
// Every series must be in one shared unit so the heights compare. A zero value
// shows an empty stub; no series at all (loading) shows a pair of stubs.
// `legend` items are { color, label, value }.
export default function BarChart({
  series: seriesProp = [],
  labels = [],
  legend = [],
  accessibilityLabel,
  height = 120,
  barWidth = 14,
}) {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  const series = seriesProp.length ? seriesProp : STUB_SERIES;
  const count = labels.length;
  const max = Math.max(0, ...series.flatMap(item => item.values));
  const dense = count > 12;
  const labelStep = dense ? Math.ceil(count / MAX_LABELS) : 1;
  const groupPadding = count <= 7 ? 7 : dense ? 1 : 3;
  const barGap = dense ? 1 : 4;
  // Explicit widths from the measured plot: flex-sized bars rendered uneven.
  const [plotWidth, setPlotWidth] = useState(0);
  const groupWidth = count ? plotWidth / count : 0;
  const width = Math.max(
    1,
    Math.min(
      barWidth,
      (groupWidth - groupPadding * 2 - barGap * (series.length - 1)) /
        series.length,
    ),
  );
  const radius = Math.min(dense ? 2 : 5, width / 2);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={[styles.plot, { height, borderBottomColor: tokens.divider }]}
        onLayout={event => setPlotWidth(event.nativeEvent.layout.width)}
      >
        {labels.map((_, index) => (
          <View
            key={index}
            style={[styles.group, { width: groupWidth, gap: barGap }]}
          >
            {series.map((item, seriesIndex) => {
              const value = item.values[index] || 0;
              const barStyle = [
                styles.bar,
                {
                  width,
                  borderTopLeftRadius: radius,
                  borderTopRightRadius: radius,
                },
              ];
              return value > 0 && max > 0 ? (
                <Bar
                  key={seriesIndex}
                  target={Math.max(MIN_BAR, Math.round((value / max) * height))}
                  reduceMotion={reduceMotion}
                  delay={index * BAR_STAGGER}
                  style={[...barStyle, { backgroundColor: item.color }]}
                />
              ) : (
                <View
                  key={seriesIndex}
                  style={[
                    ...barStyle,
                    { height: STUB_HEIGHT, backgroundColor: tokens.disc },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.xLabels}>
        {labels.map((label, index) => (
          <View key={index} style={styles.xLabelSlot}>
            <ThemeText
              CustomNumberOfLines={1}
              content={
                index % labelStep === 0 || index === count - 1 ? label : ''
              }
              styles={[styles.axisLabel, { color: tokens.muted }]}
            />
          </View>
        ))}
      </View>
      {legend.length > 0 && (
        <View style={styles.legend}>
          {legend.map(item => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <ThemeText content={item.label} styles={styles.legendText} />
              <ThemeText
                CustomNumberOfLines={1}
                content={item.value}
                styles={[
                  styles.legendText,
                  styles.legendValue,
                  { color: tokens.muted },
                ]}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Bar({ target, reduceMotion, delay, style }) {
  const animatedHeight = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    animatedHeight.value = reduceMotion
      ? target
      : withDelay(delay, withTiming(target, { duration: BAR_DURATION }));
  }, [target, delay, reduceMotion, animatedHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: Math.max(0, animatedHeight.value),
  }));

  return <Animated.View style={[style, animatedStyle]} />;
}

const styles = StyleSheet.create({
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
  },
  group: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  bar: {
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  xLabels: { flexDirection: 'row', marginTop: 8 },
  // The slot is one interval wide; the label keeps its own width and overflows
  // it so an hourly "12 AM" is never squeezed into a 12 pt column.
  xLabelSlot: { flex: 1, alignItems: 'center' },
  axisLabel: {
    width: 56,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    includeFontPadding: false,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 20,
    rowGap: 6,
    marginTop: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 13, lineHeight: 18, includeFontPadding: false },
  legendValue: { fontVariant: ['tabular-nums'] },
});
