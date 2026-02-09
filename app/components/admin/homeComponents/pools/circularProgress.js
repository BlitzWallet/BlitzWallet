import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ThemeText } from '../../../../functions/CustomElements';
import { SIZES } from '../../../../constants';
import { COLORS } from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

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
}) {
  const { theme, darkModeType } = useGlobalThemeContext();

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
    theme && darkModeType ? COLORS.lightModeText : COLORS.primary;
  const trackColor = theme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

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
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {!showPercentage ? (
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
