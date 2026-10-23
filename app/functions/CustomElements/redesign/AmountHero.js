import { StyleSheet, View } from 'react-native';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../context-store/context';
import displayCorrectDenomination from '../../displayCorrectDenomination';
import ThemeText from '../textTheme';

// Centred denomination-aware amount. Amounts shrink to fit (OQ-17).
export default function AmountHero({
  amount,
  fiatStats,
  masterInfoObject: masterInfoOverride,
  amountSize = 44,
  accessibilityLabel,
  mutedValue = false,
}) {
  const { tokens } = useTheme();
  const { masterInfoObject: contextMasterInfoObject } =
    useGlobalContextProvider();
  const displayValue = displayCorrectDenomination({
    amount,
    masterInfoObject: masterInfoOverride || contextMasterInfoObject,
    fiatStats,
  });

  return (
    <View
      style={styles.row}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      <ThemeText
        content={displayValue}
        CustomNumberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        styles={[
          styles.amount,
          {
            fontSize: amountSize,
            // lineHeight,
            letterSpacing: -(amountSize * 0.035),
            color: mutedValue ? tokens.muted : tokens.ink,
          },
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
    fontFamily: FONT.Title_Medium,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    flexShrink: 1,
  },
});
