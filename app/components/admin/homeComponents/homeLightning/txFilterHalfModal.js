import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import { CENTER } from '../../../../constants';
import { useEffect, useState } from 'react';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import CustomButton from '../../../../functions/CustomElements/button';

const TYPE_KEYS = [
  'Lightning',
  'Bitcoin',
  'Spark',
  'Contacts',
  'Gifts',
  'Swaps',
  'Savings',
  'Pools',
];

const DATE_OPTIONS = [
  { key: '7d', labelKey: 'filterDate7d' },
  { key: '30d', labelKey: 'filterDate30d' },
  { key: '90d', labelKey: 'filterDate90d' },
  { key: '1y', labelKey: 'filterDate1y' },
];

const DIRECTION_OPTIONS = [
  { dir: 'sent', icon: 'ArrowUp', labelKey: 'filterSent' },
  { dir: 'received', icon: 'ArrowDown', labelKey: 'filterReceived' },
];

export default function TxFilterHalfModal({
  currentFilter,
  onSelectFilter,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const { textColor, backgroundColor, backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();

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
        ? prev.types.filter(existingType => existingType !== type)
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
  const inactiveBorderColor =
    theme && darkModeType ? backgroundColor : backgroundOffset;

  const hasItemsSeleceted =
    draft.directions.length || draft.dateRange || draft.types.length;

  return (
    <View style={styles.container}>
      <ThemeText styles={styles.title} content={t(`${ns}.filterModalTitle`)} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* --- Direction --- */}
        <ThemeText
          styles={styles.sectionLabel}
          content={t(`${ns}.filterDirectionTitle`)}
        />
        <View style={styles.directionRow}>
          {DIRECTION_OPTIONS.map(({ dir, icon, labelKey }) => {
            const isActive = draft.directions.includes(dir);
            return (
              <TouchableOpacity
                key={dir}
                style={[
                  styles.directionCard,
                  isActive
                    ? {
                        backgroundColor:
                          theme && darkModeType
                            ? backgroundColor
                            : COLORS.primary,
                        borderColor:
                          theme && darkModeType
                            ? backgroundColor
                            : COLORS.primary,
                      }
                    : [
                        styles.cardInactive,
                        { borderColor: inactiveBorderColor },
                      ],
                ]}
                onPress={() => toggleDirection(dir)}
                activeOpacity={0.7}
              >
                <ThemeIcon
                  iconName={icon}
                  size={20}
                  colorOverride={isActive ? '#fff' : textColor}
                />
                <ThemeText
                  styles={[
                    styles.directionLabel,
                    { color: isActive ? '#fff' : textColor },
                  ]}
                  content={t(`${ns}.${labelKey}`)}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View
          style={[styles.divider, { borderTopColor: inactiveBorderColor }]}
        />

        {/* --- Date Range --- */}
        <ThemeText
          styles={styles.sectionLabel}
          content={t(`${ns}.filterDateTitle`)}
        />
        <View style={styles.pillRow}>
          {DATE_OPTIONS.map(({ key, labelKey }) => {
            const isActive = draft.dateRange === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.pill,
                  isActive
                    ? {
                        backgroundColor:
                          theme && darkModeType
                            ? backgroundColor
                            : COLORS.primary,
                        borderColor:
                          theme && darkModeType
                            ? backgroundColor
                            : COLORS.primary,
                      }
                    : [
                        styles.pillInactive,
                        { borderColor: inactiveBorderColor },
                      ],
                ]}
                onPress={() => toggleDate(key)}
                activeOpacity={0.7}
              >
                <ThemeText
                  styles={[
                    styles.pillText,
                    { color: isActive ? '#fff' : textColor },
                  ]}
                  content={t(`${ns}.${labelKey}`)}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View
          style={[styles.divider, { borderTopColor: inactiveBorderColor }]}
        />

        {/* --- Transaction Type --- */}
        <ThemeText
          styles={styles.sectionLabel}
          content={t(`${ns}.filterTypeTitle`)}
        />
        <View style={styles.pillRow}>
          {TYPE_KEYS.map(type => {
            const isActive = draft.types.includes(type);
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.pill,
                  isActive
                    ? {
                        backgroundColor:
                          theme && darkModeType
                            ? backgroundColor
                            : COLORS.primary,
                        borderColor:
                          theme && darkModeType
                            ? backgroundColor
                            : COLORS.primary,
                      }
                    : [
                        styles.pillInactive,
                        { borderColor: inactiveBorderColor },
                      ],
                ]}
                onPress={() => toggleType(type)}
                activeOpacity={0.7}
              >
                <ThemeText
                  styles={[
                    styles.pillText,
                    { color: isActive ? '#fff' : textColor },
                  ]}
                  content={t(`${ns}.filter${type}`)}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* --- Sticky bottom bar --- */}
      <View style={[styles.bottomBar, { borderTopColor: inactiveBorderColor }]}>
        <TouchableOpacity
          style={{
            opacity: hasItemsSeleceted ? 1 : HIDDEN_OPACITY,
            flexShrink: 1,
          }}
          onPress={handleClear}
          activeOpacity={hasItemsSeleceted ? 0.2 : HIDDEN_OPACITY}
        >
          <ThemeText
            CustomNumberOfLines={2}
            adjustsFontSizeToFit={true}
            allowFontScaling={true}
            content={t(`${ns}.filterClearAll`)}
          />
        </TouchableOpacity>
        <CustomButton
          buttonStyles={styles.applyButton}
          actionFunction={handleApply}
          textContent={t(`${ns}.filterApply`)}
        />
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
  scrollView: {
    flex: 1,
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
  cardInactive: {},
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
  pillInactive: {},
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
    gap: 10,
  },
  clearText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  applyButton: {
    width: '50%',
    flexShrink: 1,
  },
  applyText: {
    color: '#fff',
    fontSize: SIZES.medium,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
