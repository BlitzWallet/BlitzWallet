import { StyleSheet, TouchableOpacity, View } from 'react-native';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../functions/CustomElements';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import CustomButton from '../../functions/CustomElements/button';
import GetThemeColors from '../../hooks/themeColors';
import { CENTER, FONT } from '../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../constants/theme';
import {
  BTC_MAP_CATEGORIES,
  CATEGORY_META,
} from '../../functions/btcMap/iconCategory';

const DEFAULT_FILTER = { categories: [], distanceUnit: 'auto' };
const DISTANCE_UNITS = ['auto', 'km', 'mi'];

export default function BTCMapFilterContent({
  currentFilter,
  onSelectFilter,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();

  const [draft, setDraft] = useState({
    categories: currentFilter?.categories ?? DEFAULT_FILTER.categories,
    distanceUnit: currentFilter?.distanceUnit ?? DEFAULT_FILTER.distanceUnit,
  });

  useEffect(() => {
    setContentHeight(560);
  }, [setContentHeight]);

  const hasActiveSelections =
    draft.categories.length > 0 || draft.distanceUnit !== 'auto';

  const toggleCategory = useCallback(category => {
    setDraft(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(item => item !== category)
        : [...prev.categories, category],
    }));
  }, []);

  const handleSelectAllCategories = useCallback(() => {
    setDraft(prev => ({ ...prev, categories: [] }));
  }, []);

  const handleSelectUnit = useCallback(unit => {
    setDraft(prev => ({ ...prev, distanceUnit: unit }));
  }, []);

  const handleClear = useCallback(() => {
    setDraft({ categories: [], distanceUnit: 'auto' });
  }, []);

  const handleApply = useCallback(() => {
    onSelectFilter({
      categories: draft.categories,
      distanceUnit: draft.distanceUnit,
    });
    handleBackPressFunction();
  }, [draft, handleBackPressFunction, onSelectFilter]);

  const renderPill = (
    isActive,
    label,
    onPress,
    key,
    paddingHorizontal = 18,
  ) => (
    <TouchableOpacity
      key={key}
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.pill,
        {
          paddingHorizontal,
          backgroundColor: isActive ? tokens.accent : tokens.ground,
        },
      ]}
    >
      <ThemeText
        styles={[
          styles.pillText,
          { color: isActive ? tokens.onAccent : tokens.ink },
        ]}
        content={label}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <CustomScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <ThemeText
          styles={styles.title}
          content={t('screens.btcMap.filter.title')}
        />

        <ThemeText
          styles={[styles.sectionLabel, { color: tokens.muted }]}
          content={t('screens.btcMap.filter.categoriesTitle')}
        />

        <View style={styles.pillRow}>
          {renderPill(
            draft.categories.length === 0,
            t('screens.btcMap.filter.all'),
            handleSelectAllCategories,
            'all',
            18,
          )}

          {BTC_MAP_CATEGORIES.map(category => {
            const isActive = draft.categories.includes(category);
            return (
              <TouchableOpacity
                key={category}
                activeOpacity={0.75}
                onPress={() => toggleCategory(category)}
                style={[
                  styles.pill,
                  styles.pillWithIcon,
                  {
                    paddingHorizontal: 14,
                    backgroundColor: isActive ? tokens.accent : tokens.ground,
                  },
                ]}
              >
                <ThemeIcon
                  iconName={CATEGORY_META[category].icon}
                  size={16}
                  redesign
                  colorOverride={isActive ? tokens.onAccent : tokens.ink}
                />
                <ThemeText
                  styles={[
                    styles.pillText,
                    { color: isActive ? tokens.onAccent : tokens.ink },
                  ]}
                  content={t(CATEGORY_META[category].labelKey)}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <ThemeText
          styles={[styles.distanceLabel, { color: tokens.muted }]}
          content={t('screens.btcMap.filter.distanceTitle')}
        />

        <View style={styles.pillRow}>
          {DISTANCE_UNITS.map(unit =>
            renderPill(
              draft.distanceUnit === unit,
              t(`screens.btcMap.filter.${unit}`),
              () => handleSelectUnit(unit),
              unit,
            ),
          )}
        </View>

      </CustomScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.clearButton,
            { opacity: hasActiveSelections ? 1 : HIDDEN_OPACITY },
          ]}
          onPress={handleClear}
          activeOpacity={hasActiveSelections ? 0.2 : HIDDEN_OPACITY}
        >
          <ThemeText
            styles={[styles.clearText, { color: tokens.link }]}
            content={t('screens.btcMap.filter.clear')}
          />
        </TouchableOpacity>

        <CustomButton
          buttonStyles={styles.applyButton}
          actionFunction={handleApply}
          textContent={t('screens.btcMap.filter.apply')}
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
    lineHeight: 26,
    marginTop: 20,
    includeFontPadding: false,
  },
  sectionLabel: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.smedium,
    lineHeight: 20,
    marginTop: 16,
    marginHorizontal: 4,
    marginBottom: 8,
    includeFontPadding: false,
  },
  distanceLabel: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.smedium,
    lineHeight: 20,
    marginTop: 20,
    marginHorizontal: 4,
    marginBottom: 8,
    includeFontPadding: false,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    minHeight: 44,
    borderRadius: 999,
    justifyContent: 'center',
  },
  pillWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.smedium,
    lineHeight: 20,
    includeFontPadding: false,
  },
  bottomBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 'auto',
  },
  clearButton: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  clearText: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.medium,
    lineHeight: 22,
    includeFontPadding: false,
  },
  applyButton: {
    flex: 1,
    width: '100%',
    minHeight: 52,
  },
});
