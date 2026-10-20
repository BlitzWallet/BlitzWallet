import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';
import { RowShell } from './ListRow';

// Radio row: 24 radio, off = 2 px `grab` ring, on = accent + white check
// 14 / stroke 3 (SHARED_FINDINGS C5).
export default function PickRow({ title, sub, lead, selected, onPress }) {
  const { tokens } = useTheme();
  return (
    <RowShell
      onPress={onPress}
      lead={lead}
      accessibilityRole="radio"
      accessibilityState={{ checked: !!selected }}
      trailing={
        <View
          style={[
            styles.radio,
            selected
              ? { backgroundColor: tokens.accent }
              : { borderWidth: 2, borderColor: tokens.grab },
          ]}
        >
          {selected && (
            <ThemeIcon
              iconName="Check"
              size={14}
              strokeWidth={3}
              colorOverride={tokens.onAccent}
            />
          )}
        </View>
      }
    >
      <View style={styles.texts}>
        <ThemeText variant="body" content={title} styles={styles.title} />
        {!!sub && <ThemeText variant="hint" content={sub} />}
      </View>
    </RowShell>
  );
}

const styles = StyleSheet.create({
  texts: { flex: 1 },
  title: { fontSize: 17, lineHeight: 24 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
