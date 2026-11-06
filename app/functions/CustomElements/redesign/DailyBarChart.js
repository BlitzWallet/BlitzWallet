import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../../../context-store/theme';
import { useReducedMotion } from '../../../constants/motion';

const BAR_WIDTH = 6;
const MAX_BAR = 60;
const EMPTY_BAR = 4;
const MIN_BAR = 8;
const STAGGER = 30;
const SPRING = {
  stiffness: 300,
  damping: 100,
  mass: 1,
};

// One bar per day (Money.dc.html). Days up to `todayIndex` grow from the
// baseline in sequence, today's (accent) lands last; empty and future days
// are flat divider ticks.
export default function DailyBarChart({
  values,
  todayIndex,
  accessibilityLabel,
}) {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  const max = Math.max(...values, 0);

  return (
    <View
      style={styles.chart}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {values.map((value, index) => {
        if (index > todayIndex || (!value && index !== todayIndex)) {
          return (
            <View
              key={index}
              style={[
                styles.bar,
                { height: EMPTY_BAR, backgroundColor: tokens.divider },
              ]}
            />
          );
        }
        const isToday = index === todayIndex;
        return (
          <Bar
            key={index}
            height={
              value
                ? Math.max(MIN_BAR, Math.round((value / max) * MAX_BAR))
                : EMPTY_BAR
            }
            delay={index * STAGGER}
            animate={!reduceMotion}
            style={
              isToday
                ? { backgroundColor: tokens.accent }
                : { backgroundColor: tokens.muted, opacity: 0.35 }
            }
          />
        );
      })}
    </View>
  );
}

function Bar({ height, delay, animate, style }) {
  const animatedHeight = useSharedValue(animate ? 0 : height);

  useEffect(() => {
    animatedHeight.value = animate
      ? withDelay(delay, withSpring(height, SPRING))
      : height;
  }, [height, delay, animate]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: Math.max(0, animatedHeight.value),
  }));

  return <Animated.View style={[styles.bar, style, animatedStyle]} />;
}

const styles = StyleSheet.create({
  chart: {
    minHeight: MAX_BAR + 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bar: { width: BAR_WIDTH, borderRadius: BAR_WIDTH / 2 },
});
