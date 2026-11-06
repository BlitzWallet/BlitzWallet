import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';
import { useTheme } from '../../../../context-store/theme';
import { useInSheet } from './sheetSurface';

export default function BudgetCurrencyButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
}) {
  const { tokens } = useTheme();
  const inSheet = useInSheet();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.currencyButton,
        { backgroundColor: inSheet ? tokens.disc : tokens.surface },
      ]}
    >
      <ThemeText content={label} styles={styles.currencyLabel} />
      {disabled ? (
        <ActivityIndicator size="small" color={tokens.ink} />
      ) : (
        <ThemeIcon
          redesign
          iconName="ChevronDown"
          size={16}
          colorOverride={tokens.ink}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  currencyButton: {
    minHeight: 44,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  currencyLabel: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
});
