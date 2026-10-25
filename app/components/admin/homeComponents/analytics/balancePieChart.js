import { useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { COLORS } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { ThemeText } from '../../../../functions/CustomElements/index';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { FONT } from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { convertToDecimals } from '../../../../functions/spark/swapAmountUtils';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 96;
const STROKE_WIDTH = 14;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function BalancePieChart({ isBalanceHidden }) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { bitcoinBalance, dollarBalanceSat, dollarBalanceToken } =
    useUserBalanceContext();
  const { tokens } = useGlobalThemeContext();
  const { t } = useTranslation();

  const btcValue = bitcoinBalance;
  const dollarValue = dollarBalanceSat || 0;
  const dollarValueuUSD = parseFloat(dollarBalanceToken) || 0;

  const total = btcValue + dollarValue;
  const isEmpty = total === 0;
  const btcPct = isEmpty ? 0 : Math.min((btcValue / total) * 100, 100);

  const totalText = useMemo(
    () =>
      displayCorrectDenomination({
        amount: total,
        masterInfoObject,
        fiatStats,
      }),
    [total, masterInfoObject, fiatStats],
  );

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
    return () => {
      clearTimeout(timer);
      cancelAnimation(animatedPct);
    };
  }, [btcPct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE - (animatedPct.value / 100) * CIRCUMFERENCE,
  }));

  const formatLegendValue = (value, key) =>
    displayCorrectDenomination({
      amount: value,
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: key === 'dollar' ? 'fiat' : 'sats',
      },
      fiatStats,
      convertAmount: key === 'btc',
      forceCurrency: 'USD',
    });

  const visibleSegments = isEmpty
    ? []
    : [
        btcValue > 0 && {
          key: 'btc',
          label: t('constants.bitcoin_upper'),
          color: COLORS.bitcoinOrange,
          value: btcValue,
        },
        dollarValue > 0 && {
          key: 'dollar',
          label: t('constants.dollars_upper'),
          color: COLORS.dollarGreen,
          value: convertToDecimals(dollarValueuUSD),
        },
      ].filter(Boolean);

  return (
    <View style={[styles.card, { backgroundColor: tokens.surface }]}>
      <Svg width={SIZE} height={SIZE}>
        {/* Track: dollar colour (full circle), grey when empty */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={isEmpty ? tokens.disc : COLORS.dollarGreen}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {!isEmpty && (
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={COLORS.bitcoinOrange}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </Svg>
      <View style={styles.texts}>
        <ThemeText
          styles={[styles.label, { color: tokens.muted }]}
          content={t('analytics.home.totalBalance')}
        />
        <ThemeText
          styles={[styles.total, isBalanceHidden && styles.hiddenText]}
          content={isBalanceHidden ? 'A A A A A' : totalText}
          CustomNumberOfLines={1}
          adjustsFontSizeToFit={true}
        />
        {visibleSegments.map(seg => (
          <View key={seg.key} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: seg.color }]} />
            <ThemeText
              styles={[styles.legendLabel, { color: tokens.muted }]}
              content={seg.label}
            />
            <ThemeText
              styles={[styles.legendAmount, isBalanceHidden && styles.hiddenText]}
              content={
                isBalanceHidden
                  ? 'A A A A A'
                  : formatLegendValue(seg.value, seg.key)
              }
              CustomNumberOfLines={1}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  texts: { flex: 1, gap: 8 },
  label: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  total: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.48,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  hiddenText: {
    fontFamily: FONT.Asterisk,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  legendAmount: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
});
