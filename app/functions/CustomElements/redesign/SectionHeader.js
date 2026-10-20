import { StyleSheet } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';

// 14/400 muted, 24 above (SHARED §1.3, SHARED_FINDINGS I.8).
export default function SectionHeader({ title }) {
  const { tokens } = useTheme();
  return (
    <ThemeText
      content={title}
      styles={[styles.header, { color: tokens.muted }]}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 16,
    includeFontPadding: false,
  },
});
