import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../../context-store/theme';
import ThemeText from '../../../../functions/CustomElements/textTheme';

const KIND_INDEX = { contacts: 0, pools: 1, gifts: 2 };

// One segmented bar, then a row per kind with a colour dot and its amount.
// `kinds` comes from aggregatePeriod: fixed order, every kind, zeros included.
export default function AnalyticsKinds({ kinds, formatAmount }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const colorOf = key =>
    key in KIND_INDEX ? tokens.kinds[KIND_INDEX[key]] : tokens.grab;
  // Zero kinds stay out of the bar so they don't leave empty gaps.
  const segments = kinds.filter(kind => kind.value > 0);

  return (
    <View style={[styles.card, { backgroundColor: tokens.surface }]}>
      <View
        style={[
          styles.segments,
          // Nothing spent: an empty track instead of no bar at all.
          !segments.length && { backgroundColor: tokens.disc },
        ]}
      >
        {segments.map(kind => (
          <View
            key={kind.key}
            style={{ flex: kind.value, backgroundColor: colorOf(kind.key) }}
          />
        ))}
      </View>
      <View style={styles.rows}>
        {kinds.map(kind => (
          <View key={kind.key} style={styles.row}>
            <View style={styles.label}>
              <View
                style={[styles.dot, { backgroundColor: colorOf(kind.key) }]}
              />
              <ThemeText
                content={t(`analytics.kinds.${kind.key}`)}
                styles={styles.text}
              />
            </View>
            <ThemeText
              CustomNumberOfLines={1}
              content={formatAmount(kind.value)}
              styles={[styles.text, styles.amount]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 20 },
  segments: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 2,
  },
  rows: { marginTop: 14, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
  amount: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
