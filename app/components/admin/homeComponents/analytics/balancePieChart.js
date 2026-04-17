import { useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS, SIZES } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { useSavings } from '../../../../../context-store/savingsContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { ThemeText } from '../../../../functions/CustomElements/index';
import GetThemeColors from '../../../../hooks/themeColors';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import { dollarsToSats } from '../../../../functions/spark/flashnet';
import { useTranslation } from 'react-i18next';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 200;
const STROKE_WIDTH = 16;
export default function BalancePieChart() {
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { bitcoinBalance, dollarBalanceSat } = useUserBalanceContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { savingsBalance } = useSavings();
  const { poolInfo } = useFlashnet();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const denomination = masterInfoObject?.userBalanceDenomination || 'sats';
  const btcPrice = poolInfo?.currentPriceAInB;

  const savingsToBtc = useMemo(() => {
    if (!savingsBalance || !btcPrice) return 0;
    return dollarsToSats(savingsBalance, btcPrice);
  }, [savingsBalance, btcPrice, denomination]);

  const btcValue = bitcoinBalance;
  const dollarValue = (dollarBalanceSat || 0) + (savingsToBtc || 0);

  const total = btcValue + dollarValue;
  const isEmpty = total === 0;

  const btcPct = isEmpty ? 0 : Math.min((btcValue / total) * 100, 100);

  const isSats = denomination === 'sats' || denomination === 'hidden';
  const centerText = useMemo(() => {
    return displayCorrectDenomination({
      amount: total,
      masterInfoObject,
      fiatStats,
    });
  }, [isEmpty, isSats, total, masterInfoObject, fiatStats]);

  // Ring geometry
  const radius = (SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;

  // Reanimated
  const animatedPct = useSharedValue(0);
  const isInitialRef = useRef(true);

  useEffect(() => {
    const delay = isInitialRef.current ? 150 : 0;
    isInitialRef.current = false;
    const timer = setTimeout(() => {
      animatedPct.value = withTiming(btcPct, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [btcPct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference - (animatedPct.value / 100) * circumference,
  }));

  // Legend helpers
  const formatLegendValue = value => {
    return displayCorrectDenomination({
      amount: value,
      masterInfoObject,
      fiatStats,
    });
  };

  const btcPercent = isEmpty ? 0 : Math.round((btcValue / total) * 100);
  const dolPercent = isEmpty ? 0 : 100 - btcPercent;

  const visibleSegments = isEmpty
    ? []
    : [
        btcValue > 0 && {
          key: 'btc',
          label: t('constants.bitcoin_upper'),
          color:
            theme && darkModeType ? COLORS.darkModeText : COLORS.bitcoinOrange,
          value: btcValue,
          percent: btcPercent,
        },
        dollarValue > 0 && {
          key: 'dollar',
          label: t('constants.dollars_upper'),
          color: theme && darkModeType ? COLORS.gray : COLORS.dollarGreen,
          value: dollarValue,
          percent: dolPercent,
        },
      ].filter(Boolean);

  return (
    <View style={styles.container}>
      {/* Ring */}
      <View style={styles.chartContainer}>
        <Svg width={SIZE} height={SIZE}>
          {/* Track — dollar color (always full circle) */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            stroke={
              isEmpty
                ? theme
                  ? backgroundOffset
                  : COLORS.gray2
                : theme && darkModeType
                ? COLORS.gray
                : COLORS.dollarGreen
            }
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Animated arc — bitcoin color */}
          {!isEmpty && (
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={radius}
              stroke={
                theme && darkModeType
                  ? COLORS.darkModeText
                  : COLORS.bitcoinOrange
              }
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={circumference}
              animatedProps={animatedProps}
              strokeLinecap="round"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          )}
        </Svg>

        {/* Center text */}
        <View style={styles.centerLabel} pointerEvents="none">
          <ThemeText
            styles={styles.centerText}
            content={centerText}
            CustomNumberOfLines={1}
            adjustsFontSizeToFit={true}
          />
          <ThemeText
            styles={styles.centerTextLabel}
            content={t('analytics.home.totalBalance')}
            CustomNumberOfLines={1}
            adjustsFontSizeToFit={true}
          />
        </View>
      </View>
      {/* Legend card */}
      {visibleSegments.length > 0 && (
        <View
          style={[styles.legendCard, { backgroundColor: backgroundOffset }]}
        >
          {visibleSegments.map((seg, idx) => (
            <View key={seg.key}>
              <View
                style={[
                  styles.legendRow,
                  {
                    [seg.key === 'btc' ? 'marginBottom' : 'marginTop']: 10,
                  },
                ]}
              >
                <View style={[styles.swatch, { backgroundColor: seg.color }]} />
                <ThemeText styles={styles.legendLabel} content={seg.label} />
                <ThemeText
                  styles={styles.legendAmount}
                  content={formatLegendValue(seg.value)}
                  CustomNumberOfLines={1}
                  adjustsFontSizeToFit={true}
                />
                <ThemeText
                  styles={styles.legendPercent}
                  content={`${seg.percent}%`}
                />
              </View>
              {idx < visibleSegments.length - 1 && (
                <View style={[styles.divider, { backgroundColor }]} />
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  centerLabel: {
    position: 'absolute',
    width: SIZE - STROKE_WIDTH * 2 - 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    fontSize: SIZES.large,
    textAlign: 'center',
    includeFontPadding: false,
  },
  centerTextLabel: {
    fontSize: SIZES.small,
    textAlign: 'center',
    includeFontPadding: false,
    opacity: HIDDEN_OPACITY,
  },
  legendCard: {
    borderRadius: 16,
    padding: 16,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    includeFontPadding: false,
  },
  legendAmount: {
    flex: 1,
    fontSize: SIZES.medium,
    textAlign: 'right',
    includeFontPadding: false,
  },
  legendPercent: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'right',
    includeFontPadding: false,
  },
  divider: {
    height: 2,
    borderRadius: 0.5,
  },
});
