import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';
import CustomToggleSwitch from '../switch';

// Row: lead · title/sub (wrap) · trailing. The trailing value drops under
// the title when both don't fit (rule 2). Self-contained, so it can be a
// FlatList renderItem.
const noop = () => {};

export default function ListRow({
  title,
  sub,
  lead,
  trailing,
  value,
  tone = 'default',
  onPress,
}) {
  const { tokens } = useTheme();
  return (
    <RowShell
      onPress={onPress}
      lead={lead}
      accessibilityRole={trailing === 'switch' ? 'switch' : 'button'}
      accessibilityState={
        trailing === 'switch'
          ? { checked: !!value }
          : trailing === 'check'
          ? { selected: true }
          : undefined
      }
      trailing={
        trailing === 'chevron' ? (
          <ThemeIcon
            redesign
            iconName="ChevronRight"
            size={20}
            colorOverride={tokens.muted}
          />
        ) : trailing === 'switch' ? (
          <CustomToggleSwitch
            stateValue={!!value}
            // Never let the switch fall back to its masterInfoObject writes.
            toggleSwitchFunction={onPress || noop}
          />
        ) : trailing === 'check' ? (
          <ThemeIcon
            redesign
            iconName="Check"
            size={20}
            colorOverride={tokens.accent}
          />
        ) : null
      }
    >
      <View style={styles.texts}>
        <ThemeText
          content={title}
          styles={[styles.title, tone === 'danger' && { color: tokens.danger }]}
        />
        {!!sub && <ThemeText variant="hint" content={sub} />}
      </View>
      {trailing === 'value' && (
        <ThemeText
          variant="body"
          content={value}
          styles={{ color: tokens.muted, flexShrink: 1 }}
        />
      )}
    </RowShell>
  );
}

// Shared row frame for ListRow and PickRow: min height 56, gap 12.
export function RowShell({
  onPress,
  lead,
  trailing,
  accessibilityRole,
  accessibilityState,
  children,
}) {
  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? accessibilityRole : undefined}
      accessibilityState={accessibilityState}
      style={styles.row}
    >
      {lead}
      <View style={styles.middle}>{children}</View>
      {trailing}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  middle: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 12,
  },
  texts: { flexGrow: 1, flexShrink: 1 },
  title: {
    fontFamily: FONT.Title_Regular,
    fontSize: 17,
    lineHeight: 24,
    includeFontPadding: false,
  },
});
