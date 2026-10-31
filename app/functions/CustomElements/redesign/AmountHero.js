import { StyleSheet, View } from 'react-native';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../context-store/context';
import displayCorrectDenomination from '../../displayCorrectDenomination';
import ThemeText from '../textTheme';

// Centred denomination-aware amount. Amounts shrink to fit (OQ-17).
// `splitCents` draws the ".00" at half size in muted (Dollar goals heroes);
// `splitUnit` does the same for a trailing " sats". `isHidden` draws dots.
export function splitAmountUnit(value) {
  return String(value).match(/^(.*\d)(\s*\D+)$/);
}

export default function AmountHero({
  amount,
  fiatStats,
  masterInfoObject: masterInfoOverride,
  amountSize = 44,
  accessibilityLabel,
  mutedValue = false,
  forceCurrency,
  convertAmount,
  splitCents = false,
  formatAmount = true,
  isHidden = false,
  splitUnit = false,
  lineHeight,
  amountFont = FONT.Title_Medium,
  fractionFont = FONT.Title_Regular,
}) {
  const { tokens } = useTheme();
  const { masterInfoObject: contextMasterInfoObject } =
    useGlobalContextProvider();
  const displayValue = formatAmount
    ? displayCorrectDenomination({
        amount,
        masterInfoObject: masterInfoOverride || contextMasterInfoObject,
        fiatStats,
        forceCurrency,
        convertAmount,
      })
    : amount;
  const centsMatch =
    (splitCents
      ? String(displayValue).match(/^(.*\d)([.,]\d{2})(\D*)$/)
      : null) || (splitUnit ? splitAmountUnit(displayValue) : null);

  return (
    <View
      style={styles.row}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      <ThemeText
        content={
          isHidden
            ? '••••••'
            : centsMatch
            ? [
                centsMatch[1],
                <ThemeText
                  key="cents"
                  content={centsMatch[2] + (centsMatch[3] || '')}
                  styles={[
                    styles.cents,
                    {
                      fontFamily: fractionFont,
                      fontSize: amountSize / 2,
                      color: tokens.muted,
                    },
                  ]}
                />,
              ]
            : displayValue
        }
        CustomNumberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        styles={[
          styles.amount,
          {
            fontFamily: amountFont,
            fontSize: isHidden ? amountSize * 0.73 : amountSize,
            letterSpacing: isHidden
              ? amountSize * 0.088
              : -(amountSize * 0.035),
            color: mutedValue ? tokens.muted : tokens.ink,
          },
          !!lineHeight && { lineHeight },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  amount: {
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    flexShrink: 1,
  },
  cents: {
    letterSpacing: 0,
    includeFontPadding: false,
  },
});
