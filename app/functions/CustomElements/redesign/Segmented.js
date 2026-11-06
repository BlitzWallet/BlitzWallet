import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';

// Controlled. White track, selected pill accent + white text in every mode
// (rule 5). Labels wrap, never truncate.
export default function Segmented({
  options,
  value,
  onChange,
  onBeforeChange,
  accessibilityLabel,
  minHeight = 44,
  capitalizeLabels = true,
  fit = false,
}) {
  const { tokens } = useTheme();

  const select = nextValue => {
    if (nextValue === value) return;
    if (onBeforeChange && onBeforeChange(nextValue) === false) return;
    onChange(nextValue);
  };

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: tokens.surface }]}
    >
      {options.map(option => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => select(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={[
              styles.segment,
              { minHeight },
              fit && styles.fitSegment,
              selected && { backgroundColor: tokens.accent },
            ]}
          >
            <ThemeText
              content={option.label}
              styles={[
                styles.label,
                !capitalizeLabels && styles.noCapitalize,
                { color: selected ? tokens.onAccent : tokens.tabIdle },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textTransform: 'capitalize',
    // 1pt inset: iOS clips glyph ink past the advance width ("QR" → "QF").
    paddingHorizontal: 1,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    includeFontPadding: false,
  },
  // Content-sized pills for a centred switch (Analytics Bitcoin/Dollars).
  fitSegment: { flex: 0, paddingHorizontal: 20 },
  noCapitalize: {
    textTransform: 'none',
  },
});
