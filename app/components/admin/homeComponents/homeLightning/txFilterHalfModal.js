import { StyleSheet, TouchableOpacity, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import {
  FONT,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import { CENTER } from '../../../../constants';
import { useEffect, useState } from 'react';
import GetThemeColors from '../../../../hooks/themeColors';
import CustomButton from '../../../../functions/CustomElements/button';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';

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
  onBack,
}) {
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();

  const [draft, setDraft] = useState({
    directions: currentFilter?.directions ?? [],
    dateRange: currentFilter?.dateRange ?? null,
    types: currentFilter?.types ?? [],
  });

  // Embedded as a step (onBack), the host sheet owns the height.
  useEffect(() => {
    if (!onBack) setContentHeight(640);
  }, [setContentHeight, onBack]);

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

  const hasItemsSeleceted =
    draft.directions.length || draft.dateRange || draft.types.length;

  const renderPill = (isActive, label, onPress, key, icon, isLarge) => (
    <TouchableOpacity
      key={key}
      style={[
        styles.pill,
        isLarge && styles.directionPill,
        { backgroundColor: isActive ? tokens.accent : tokens.ground },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {icon && (
        <ThemeIcon
          redesign
          iconName={icon}
          size={18}
          colorOverride={isActive ? tokens.onAccent : tokens.ink}
        />
      )}
      <ThemeText
        styles={[
          styles.pillText,
          isLarge && styles.directionText,
          { color: isActive ? tokens.onAccent : tokens.ink },
        ]}
        content={label}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <CustomScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {onBack && (
          <IconButton
            icon="ArrowLeft"
            label="constants.back"
            tone="disc"
            onPress={onBack}
          />
        )}
        <ThemeText
          styles={[styles.title, onBack && styles.titleAfterBack]}
          content={t(`${ns}.filterModalTitle`)}
        />

        <ThemeText
          styles={[styles.sectionLabel, { color: tokens.muted }]}
          content={t(`${ns}.filterDirectionTitle`)}
        />
        <View style={styles.directionRow}>
          {DIRECTION_OPTIONS.map(({ dir, icon, labelKey }) =>
            renderPill(
              draft.directions.includes(dir),
              t(`${ns}.${labelKey}`),
              () => toggleDirection(dir),
              dir,
              icon,
              true,
            ),
          )}
        </View>

        <ThemeText
          styles={[styles.sectionLabel, { color: tokens.muted }]}
          content={t(`${ns}.filterDateTitle`)}
        />
        <View style={styles.pillRow}>
          {DATE_OPTIONS.map(({ key, labelKey }) =>
            renderPill(
              draft.dateRange === key,
              t(`${ns}.${labelKey}`),
              () => toggleDate(key),
              key,
            ),
          )}
        </View>

        <ThemeText
          styles={[styles.sectionLabel, { color: tokens.muted }]}
          content={t(`${ns}.filterTypeTitle`)}
        />
        <View style={styles.pillRow}>
          {TYPE_KEYS.map(type =>
            renderPill(
              draft.types.includes(type),
              t(`${ns}.filter${type}`),
              () => toggleType(type),
              type,
            ),
          )}
        </View>
      </CustomScrollView>

      <View style={[styles.bottomBar, { borderTopColor: tokens.divider }]}>
        <TouchableOpacity
          style={[
            styles.clearButton,
            { opacity: hasItemsSeleceted ? 1 : HIDDEN_OPACITY },
          ]}
          onPress={handleClear}
          activeOpacity={hasItemsSeleceted ? 0.2 : HIDDEN_OPACITY}
        >
          <ThemeText
            styles={styles.clearText}
            content={t(`${ns}.filterClearAll`)}
          />
        </TouchableOpacity>
        <CustomButton
          buttonStyles={styles.applyButton}
          actionFunction={handleApply}
          textContent={t(`${ns}.filterApply`)}
          size="regular"
          tone="primary"
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
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 28,
    marginTop: 18,
    includeFontPadding: false,
  },
  titleAfterBack: {
    marginTop: 12,
  },
  sectionLabel: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.smedium,
    lineHeight: 20,
    marginTop: 20,
    marginBottom: 10,
    includeFontPadding: false,
  },
  directionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  directionPill: {
    flex: 1,
    minHeight: 52,
  },
  pillText: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.smedium,
    lineHeight: 20,
    includeFontPadding: false,
    flexShrink: 1,
  },
  directionText: {
    fontSize: 15,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  clearButton: {
    flex: 1,
    minHeight: 52,
    justifyContent: 'center',
  },
  clearText: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.medium,
    lineHeight: 22,
    includeFontPadding: false,
  },
  applyButton: {
    flex: 1,
    minHeight: 52,
  },
});
