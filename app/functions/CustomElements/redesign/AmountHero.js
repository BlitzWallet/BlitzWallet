import { StyleSheet, View } from 'react-native';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';

// Centred amount + muted unit, baseline aligned (D296 44/22, D301 48/24).
// Amounts shrink to fit (OQ-17); the unit never shrinks.
export default function AmountHero({
  value,
  unit,
  amountSize = 44,
  unitSize = 22,
  lineHeight = amountSize + 4,
  accessibilityLabel,
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={styles.row}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      <ThemeText
        content={String(value ?? '')}
        CustomNumberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        styles={[
          styles.amount,
          {
            fontSize: amountSize,
            lineHeight,
            letterSpacing: -(amountSize * 0.035),
          },
        ]}
      />
      {!!unit && (
        <ThemeText
          content={`\u00A0${unit}`}
          styles={[
            styles.unit,
            { fontSize: unitSize, color: tokens.muted, lineHeight },
          ]}
        />
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
  amount: {
    fontFamily: FONT.Title_Medium,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    flexShrink: 1,
  },
  unit: {
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },
});
