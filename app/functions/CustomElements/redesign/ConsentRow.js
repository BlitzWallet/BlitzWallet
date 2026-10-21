import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';

// Consent row for destructive/irreversible confirmations (audit X20-4):
// 24 r8 box, 14/21 copy, whole row >= 44, checkbox role.
export default function ConsentRow({
  checked,
  onPress,
  text,
  accessibilityLabel,
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!checked }}
      accessibilityLabel={accessibilityLabel || text}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          checked
            ? { backgroundColor: tokens.accent }
            : { borderWidth: 2, borderColor: tokens.grab },
        ]}
      >
        {checked && (
          <ThemeIcon
            redesign
            iconName="Check"
            size={16}
            strokeWidth={2.5}
            colorOverride={tokens.onAccent}
          />
        )}
      </View>
      <ThemeText content={text} styles={[styles.text, { color: tokens.ink }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 44,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
  },
});
