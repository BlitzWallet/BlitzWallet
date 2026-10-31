import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';

// Spinning ring: 56 header (stroke 5) or 20 active step (stroke 5), ~30 % arc.
function Ring({ size, strokeWidth, color, track }) {
  const reducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (reducedMotion) return;
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reducedMotion, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.7}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </Animated.View>
  );
}

// D297 export progress: ring header, 20/26 title, 15/22 sub, 36 pt step rows.
// steps: [{ key, label, state: 'done' | 'active' | 'pending' | 'skipped' }]
export default function StepProgress({ title, subtitle, steps = [] }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.container}>
      <Ring
        size={56}
        strokeWidth={5}
        color={tokens.accent}
        track={tokens.divider}
      />
      <ThemeText content={title} styles={styles.title} />
      {!!subtitle && (
        <ThemeText
          content={subtitle}
          styles={[styles.subtitle, { color: tokens.muted }]}
        />
      )}
      <View style={styles.list}>
        {steps
          .filter(step => step.state !== 'skipped')
          .map(step => (
            <View key={step.key} style={styles.step}>
              <View style={styles.marker}>
                {step.state === 'done' ? (
                  <View
                    style={[
                      styles.doneDisc,
                      { backgroundColor: tokens.accent },
                    ]}
                  >
                    <ThemeIcon
                      iconName="Check"
                      size={14}
                      strokeWidth={2.5}
                      colorOverride={tokens.onAccent}
                    />
                  </View>
                ) : step.state === 'active' ? (
                  <Ring
                    size={20}
                    strokeWidth={5}
                    color={tokens.accent}
                    track={tokens.divider}
                  />
                ) : (
                  <View
                    style={[
                      styles.pendingDot,
                      { backgroundColor: tokens.divider },
                    ]}
                  />
                )}
              </View>
              <ThemeText
                content={step.label}
                styles={[
                  styles.stepLabel,
                  step.state === 'pending' && { color: tokens.muted },
                ]}
              />
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 12 },
  title: {
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    includeFontPadding: false,
    marginTop: 18,
  },
  subtitle: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
    marginTop: 6,
  },
  list: { alignSelf: 'stretch', marginTop: 24 },
  step: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 12 },
  marker: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneDisc: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDot: { width: 8, height: 8, borderRadius: 4 },
  stepLabel: {
    flex: 1,
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
});
