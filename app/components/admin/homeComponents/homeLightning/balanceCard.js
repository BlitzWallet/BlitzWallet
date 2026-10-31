import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { ThemeText } from '../../../../functions/CustomElements';
import { FONT } from '../../../../constants';
import CurrencyIcon from '../../../../functions/CustomElements/redesign/CurrencyIcon';
import SkeletonBar from '../../../../functions/CustomElements/redesign/SkeletonBar';
import { splitAmountUnit } from '../../../../functions/CustomElements/redesign/AmountHero';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import formatBalanceAmount from '../../../../functions/formatNumber';
import truncateToTwoDecimals from '../../../../functions/truncateNumber';

// Fixed-unit balance text: Dollars always in USD, Bitcoin always in sats.
export function getAssetBalanceText({
  isBitcoin,
  amount,
  masterInfoObject,
  fiatStats,
}) {
  if (isBitcoin) {
    return displayCorrectDenomination({
      amount,
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: 'sats',
      },
      fiatStats,
    });
  }
  return displayCorrectDenomination({
    amount: formatBalanceAmount(
      truncateToTwoDecimals(amount),
      false,
      masterInfoObject,
    ),
    masterInfoObject: { ...masterInfoObject, userBalanceDenomination: 'fiat' },
    fiatStats,
    forceCurrency: 'USD',
    convertAmount: false,
  });
}

export default function BalanceCard({
  onPress,
  isBitcoin,
  amount = '',
  label = '',
  isHidden = false,
  isLoading = false,
}) {
  const { tokens } = GetThemeColors();
  const unitMatch = splitAmountUnit(amount);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: tokens.surface }]}
      onPress={onPress}
      disabled={isLoading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.top}>
        <CurrencyIcon size={40} isBitcoin={isBitcoin} />
        <ThemeIcon
          redesign
          iconName="ChevronRight"
          size={18}
          colorOverride={tokens.muted}
        />
      </View>
      <View style={styles.bottom}>
        <ThemeText
          styles={[styles.label, { color: tokens.muted }]}
          content={label}
        />
        {isLoading ? (
          <View style={styles.skeleton}>
            <SkeletonBar
              width={96}
              height={22}
              borderRadius={8}
              color={tokens.disc}
            />
          </View>
        ) : (
          <Animated.View
            key={isHidden ? 'hidden' : 'shown'}
            entering={FadeIn.duration(150).delay(40)}
          >
            <ThemeText
              CustomNumberOfLines={1}
              adjustsFontSizeToFit={true}
              styles={[styles.amount, isHidden && styles.hiddenAmount]}
              content={
                isHidden
                  ? '••••'
                  : unitMatch
                  ? [
                      unitMatch[1],
                      <ThemeText
                        key="unit"
                        content={unitMatch[2]}
                        styles={[styles.unit, { color: tokens.muted }]}
                      />,
                    ]
                  : amount
              }
            />
          </Animated.View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 152,
    borderRadius: 24,
    padding: 18,
    justifyContent: 'space-between',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bottom: { gap: 2 },
  label: {
    fontFamily: FONT.Title_Medium,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  amount: {
    fontFamily: FONT.Title_Medium,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.44,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  hiddenAmount: { letterSpacing: 2.64 },
  unit: {
    fontFamily: FONT.Title_Medium,
    fontSize: 15,
    letterSpacing: 0,
    includeFontPadding: false,
  },
  skeleton: { marginVertical: 3 },
});
