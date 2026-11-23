import { StyleSheet, View } from 'react-native';
import {
  AMOUNT_HERO_SIZE,
  FONT,
  HIDDEN_BALANCE_CLOSE,
} from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../context-store/context';
import displayCorrectDenomination from '../../displayCorrectDenomination';
import ThemeText from '../textTheme';
import DustChevron from './DustChevron';
import isFiatDustAmount from '../../isFiatDustAmount';

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
  amountSize = AMOUNT_HERO_SIZE.secondary,
  accessibilityLabel,
  mutedValue = false,
  forceCurrency,
  convertAmount,
  splitCents = false,
  formatAmount = true,
  isHidden = false,
  // Sub-cent fiat reads "‹ 0.01". Detected from `amount` unless the caller
  // pre-formats it (formatAmount={false}) and passes this itself.
  isDust: isDustProp,
  splitUnit = false,
  lineHeight,
  amountFont = FONT.Title_Medium,
  fractionFont = FONT.Title_Regular,
  align = 'center',
}) {
  const { tokens } = useTheme();
  const { masterInfoObject: contextMasterInfoObject } =
    useGlobalContextProvider();
  const heroMasterInfo = masterInfoOverride || contextMasterInfoObject;
  const displayValue = formatAmount
    ? displayCorrectDenomination({
        amount,
        masterInfoObject: heroMasterInfo,
        fiatStats,
        forceCurrency,
        convertAmount,
        roundUpDust: true,
      })
    : amount;
  const isDust =
    isDustProp ??
    (formatAmount &&
      isFiatDustAmount({
        amount,
        denomination: heroMasterInfo.userBalanceDenomination,
        fiatStats,
        convertAmount: convertAmount !== false,
      }));
  const centsMatch =
    (splitCents
      ? String(displayValue).match(/^(.*\d)([.,]\d{2})(\D*)$/)
      : null) || (splitUnit ? splitAmountUnit(displayValue) : null);

  const amountText = (
    <ThemeText
      content={
        isHidden
          ? HIDDEN_BALANCE_CLOSE
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
          letterSpacing: isHidden ? amountSize * 0.088 : -(amountSize * 0.035),
          color: mutedValue ? tokens.muted : tokens.ink,
        },
        !!lineHeight && { lineHeight },
      ]}
    />
  );

  return (
    <View
      style={[styles.row, align === 'left' && { justifyContent: 'flex-start' }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      {isDust && !isHidden ? (
        // Own non-wrapping baseline row keeps the chevron beside the amount.
        <View style={styles.dustRow}>
          <DustChevron fontSize={amountSize} fontFamily={amountFont} />
          {amountText}
        </View>
      ) : (
        amountText
      )}
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
  dustRow: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1 },
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
