import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';

// 32 disc + muted 13/19 text, no tinted box (rule 3). warn = amber disc.
export default function Note({ text, tone = 'info' }) {
  const { tokens } = useTheme();
  const warn = tone === 'warn';
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.disc,
          { backgroundColor: warn ? tokens.warnBg : tokens.disc },
        ]}
      >
        <ThemeIcon
          iconName={warn ? 'TriangleAlert' : 'Info'}
          size={16}
          strokeWidth={1.75}
          colorOverride={warn ? tokens.warn : tokens.ink}
        />
      </View>
      <ThemeText variant="hint" content={text} styles={styles.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  disc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, paddingTop: 6.5 },
});
