import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';

// 14/400 muted, 24 above (SHARED §1.3, SHARED_FINDINGS I.8). `right` adds a
// trailing control (D284 pencil); `first` drops the top margin to the design's
// 16 after a top bar.
export default function SectionHeader({ title, right, first = false, style }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.row,
        first ? styles.first : styles.spaced,
        !!right && styles.withRight,
        style,
      ]}
    >
      <ThemeText
        content={title}
        styles={[styles.header, { color: tokens.muted }]}
      />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 4,
    gap: 12,
  },
  spaced: { marginTop: 24, marginBottom: 8 },
  first: { marginTop: 16, marginBottom: 8 },
  withRight: { minHeight: 44, marginBottom: 8 },
  header: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    flexShrink: 1,
  },
});
