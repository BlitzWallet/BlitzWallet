import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import { useToast } from '../../../../context-store/toastManager';
import copyToClipboard from '../../copyToClipboard';
import ThemeText from '../textTheme';
import IconButton from './IconButton';

// Label · value; the value drops under the label when both don't fit.
// `copyValue` adds a 44 copy button using today's toast (OQ-52).
export default function KeyValueRow({ label, value, copyValue }) {
  const { tokens } = useTheme();
  const { showToast } = useToast();
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <ThemeText
          variant="body"
          content={label}
          styles={{ color: tokens.muted }}
        />
        <ThemeText variant="body" content={value} styles={styles.value} />
      </View>
      {copyValue != null && (
        <IconButton
          icon="Copy"
          label="constants.copy"
          tone="disc"
          onPress={() => copyToClipboard(copyValue, showToast)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  texts: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  value: { flexShrink: 1, textAlign: 'right' },
});
