import { useMemo, useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ThemeText } from '../../../../functions/CustomElements';
import { SIZES } from '../../../../constants';
import { COLORS } from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular progress ring component for pool progress display.
 * Goals are NOT caps — the ring fills to 100% max but the text shows actual amount.
 *
 * @param {number} current - Current amount in sats
 * @param {number} goal - Goal amount in sats
 * @param {number} size - Diameter of the circle (default 120)
 * @param {number} strokeWidth - Width of the progress stroke (default 6)
 * @param {string} centerText - Optional override text for center
 * @param {boolean} showPercentage - Show percentage instead of amounts
 * @param {boolean} useFillAnimation - Show fill animation
 * @param {boolean} showConfirmed - Show goal met
 */
export default function CircularProgress({
  current = 0,
  goal = 0,
  size = 120,
  strokeWidth = 6,
  centerText,
  showPercentage = false,
  fundedAmount,
  goalAmount,
  useAltBackground = false,
  useFillAnimation = false,
  showConfirmed = false,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const animatedPercentage = useSharedValue(0);
  const isInitialLoadRef = useRef(true);

  const { percentage, displayText } = useMemo(() => {
    const pct = goal > 0 ? (current / goal) * 100 : 0;
    // Cap visual at 100% but show real percentage
    const visualPct = Math.min(pct, 100);

    let text = centerText;
    if (!text) {
      if (showPercentage) {
        text = `${Math.round(pct)}%`;
      }
    }

    return { percentage: visualPct, displayText: text };
  }, [current, goal, centerText, showPercentage]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const progressColor =
    theme && darkModeType ? COLORS.darkModeText : COLORS.primary;
  const trackColor = useAltBackground ? backgroundColor : backgroundOffset;

  useEffect(() => {
    if (useFillAnimation) {
      setTimeout(
        () => {
          animatedPercentage.value = withTiming(percentage, {
            duration: 600,
            easing: Easing.out(Easing.cubic),
          });
        },
        isInitialLoadRef.current ? 150 : 0,
      );
      isInitialLoadRef.current = false;
    } else {
      animatedPercentage.value = percentage;
    }
  }, [percentage]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset =
      circumference - (animatedPercentage.value / 100) * circumference;

    return {
      strokeDashoffset,
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        {percentage > 0 && (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      {showConfirmed ? (
        <View style={[styles.centerTextContainer, { padding: 30 }]}>
          <ThemeIcon
            size={size / 2}
            strokeWidth={strokeWidth}
            iconName={'Check'}
          />
        </View>
      ) : !showPercentage ? (
        <View style={[styles.centerTextContainer, { padding: 30 }]}>
          <ThemeText
            CustomNumberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.6}
            styles={styles.fundeedAmount}
            content={fundedAmount}
          />
          <ThemeText
            CustomNumberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.6}
            styles={styles.goalAmount}
            content={`of ${goalAmount}`}
          />
        </View>
      ) : (
        <View style={[styles.centerTextContainer, { padding: 5 }]}>
          <ThemeText
            CustomNumberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.6}
            styles={styles.centerText}
            content={displayText}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  centerTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    flexShrink: 1,
  },
  fundeedAmount: {
    fontSize: SIZES.xxLarge,
    fontWeight: 500,
    textAlign: 'center',
    includeFontPadding: false,
    flexShrink: 1,
  },
  goalAmount: {
    fontSize: SIZES.small,
    opacity: 0.8,
    includeFontPadding: false,
    textAlign: 'center',
    flexShrink: 1,
  },
  centerText: {
    width: '100%',
    fontSize: SIZES.small,
    textAlign: 'center',
    flexShrink: 1,
  },
});
