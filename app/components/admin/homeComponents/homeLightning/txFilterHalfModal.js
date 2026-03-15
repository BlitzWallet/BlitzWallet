import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { COLORS, INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { CENTER } from '../../../../constants';
import { useEffect, useState } from 'react';
import GetThemeColors from '../../../../hooks/themeColors';

const TYPE_KEYS = [
  'Lightning', 'Bitcoin', 'Spark', 'Contacts',
  'Gifts', 'Swaps', 'Savings', 'Pools',
];

const DATE_OPTIONS = [
  { key: '7d', labelKey: 'filterDate7d' },
  { key: '30d', labelKey: 'filterDate30d' },
  { key: '90d', labelKey: 'filterDate90d' },
  { key: '1y', labelKey: 'filterDate1y' },
];

export default function TxFilterHalfModal({
  currentFilter,
  onSelectFilter,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const { textColor } = GetThemeColors();

  const [draft, setDraft] = useState({
    directions: currentFilter?.directions ?? [],
    dateRange: currentFilter?.dateRange ?? null,
    types: currentFilter?.types ?? [],
  });

  useEffect(() => {
    setContentHeight(680);
  }, [setContentHeight]);

  const toggleDirection = dir => {
    setDraft(prev => ({
      ...prev,
      directions: prev.directions.includes(dir)
        ? prev.directions.filter(d => d !== dir)
        : [...prev.directions, dir],
    }));
  };

  const toggleDate = range => {
    setDraft(prev => ({
      ...prev,
      dateRange: prev.dateRange === range ? null : range,
    }));
  };

  const toggleType = type => {
    setDraft(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type],
    }));
  };

  const handleClear = () => {
    setDraft({ directions: [], dateRange: null, types: [] });
  };

  const handleApply = () => {
    onSelectFilter(draft);
    handleBackPressFunction();
  };

  const ns = 'screens.inAccount.viewAllTxPage';
  const inactiveBorderColor = textColor + '30';

  return (
    <View style={styles.container}>
      <ThemeText styles={styles.title} content={t(`${ns}.filterModalTitle`)} />

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* --- Direction --- */}
        <ThemeText styles={styles.sectionLabel} content={t(`${ns}.filterDirectionTitle`)} />
        <View style={styles.directionRow}>
          {[
            { dir: 'sent', icon: 'ArrowUp', labelKey: 'filterSent' },
            { dir: 'received', icon: 'ArrowDown', labelKey: 'filterReceived' },
          ].map(({ dir, icon, labelKey }) => {
            const isActive = draft.directions.includes(dir);
            return (
              <TouchableOpacity
                key={dir}
                style={[
                  styles.directionCard,
                  isActive
                    ? styles.cardActive
                    : [styles.cardInactive, { borderColor: inactiveBorderColor }],
                ]}
                onPress={() => toggleDirection(dir)}
                activeOpacity={0.7}
              >
                <ThemeIcon
                  iconName={icon}
                  size={20}
                  colorOverride={isActive ? '#fff' : textColor}
                />
                <Text style={[styles.directionLabel, { color: isActive ? '#fff' : textColor }]}>
                  {t(`${ns}.${labelKey}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.divider, { borderTopColor: inactiveBorderColor }]} />

        {/* --- Date Range --- */}
        <ThemeText styles={styles.sectionLabel} content={t(`${ns}.filterDateTitle`)} />
        <View style={styles.pillRow}>
          {DATE_OPTIONS.map(({ key, labelKey }) => {
            const isActive = draft.dateRange === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.pill,
                  isActive
                    ? styles.pillActive
                    : [styles.pillInactive, { borderColor: inactiveBorderColor }],
                ]}
                onPress={() => toggleDate(key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, { color: isActive ? '#fff' : textColor }]}>
                  {t(`${ns}.${labelKey}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.divider, { borderTopColor: inactiveBorderColor }]} />

        {/* --- Transaction Type --- */}
        <ThemeText styles={styles.sectionLabel} content={t(`${ns}.filterTypeTitle`)} />
        <View style={styles.pillRow}>
          {TYPE_KEYS.map(type => {
            const isActive = draft.types.includes(type);
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.pill,
                  isActive
                    ? styles.pillActive
                    : [styles.pillInactive, { borderColor: inactiveBorderColor }],
                ]}
                onPress={() => toggleType(type)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, { color: isActive ? '#fff' : textColor }]}>
                  {t(`${ns}.filter${type}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* --- Sticky bottom bar --- */}
      <View style={[styles.bottomBar, { borderTopColor: inactiveBorderColor }]}>
        <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
          <Text style={[styles.clearText, { color: textColor }]}>
            {t(`${ns}.filterClearAll`)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={handleApply} activeOpacity={0.8}>
          <Text style={styles.applyText}>{t(`${ns}.filterApply`)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 20,
    includeFontPadding: false,
  },
  sectionLabel: {
    fontSize: SIZES.small,
    marginBottom: 10,
    includeFontPadding: false,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  directionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  directionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  cardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  cardInactive: {
    borderWidth: 1.5,
  },
  directionLabel: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
    fontWeight: '500',
  },
  divider: {
    borderTopWidth: 1,
    marginVertical: 16,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillInactive: {
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  clearText: {
    fontSize: SIZES.medium,
    textDecorationLine: 'underline',
    includeFontPadding: false,
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  applyText: {
    color: '#fff',
    fontSize: SIZES.medium,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
