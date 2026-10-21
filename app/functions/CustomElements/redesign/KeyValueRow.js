import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import { useToast } from '../../../../context-store/toastManager';
import copyToClipboard from '../../copyToClipboard';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';

// Label · value (D294 key/value rows). `layout="stacked"` puts the value under
// the label (fee rows, D300). `truncate="middle"` fits long ids on one line.
function middleEllipsis(value, first = 9, last = 6) {
  const text = String(value ?? '');
  if (text.length <= first + last + 1) return text;
  return `${text.slice(0, first)}…${text.slice(-last)}`;
}

export default function KeyValueRow({
  label,
  value,
  copyValue,
  copyLabel,
  layout = 'inline',
  truncate,
  mono = true,
}) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const displayValue =
    truncate === 'middle' ? middleEllipsis(value) : String(value ?? '');

  if (layout === 'stacked') {
    return (
      <View style={styles.stacked}>
        <ThemeText
          variant="body"
          content={label}
          styles={styles.stackedLabel}
        />
        <ThemeText
          variant="body"
          content={displayValue}
          styles={[styles.stackedValue, { color: tokens.muted }]}
        />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <ThemeText
        variant="body"
        content={label}
        styles={[styles.label, { color: tokens.muted }]}
      />
      <ThemeText
        content={displayValue}
        CustomNumberOfLines={1}
        styles={[
          styles.value,
          !mono && styles.valueText,
          { color: tokens.ink },
        ]}
      />
      {copyValue != null && (
        <TouchableOpacity
          onPress={() => copyToClipboard(copyValue, showToast)}
          accessibilityRole="button"
          accessibilityLabel={
            copyLabel || t('settings.sparkInfo.copyA11y', { label })
          }
          style={styles.copyButton}
        >
          <ThemeIcon
            redesign
            iconName="Copy"
            size={16}
            colorOverride={tokens.muted}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: { flexGrow: 0, flexShrink: 1 },
  value: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
    fontFamily: FONT.mono,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  valueText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
  },
  copyButton: {
    width: 44,
    height: 44,
    marginRight: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stacked: { paddingVertical: 14 },
  stackedLabel: { fontSize: 15, lineHeight: 22 },
  stackedValue: { fontSize: 14, lineHeight: 20, marginTop: 2 },
});
