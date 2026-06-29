import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../functions/CustomElements';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import CustomButton from '../../functions/CustomElements/button';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { CENTER } from '../../constants';
import {
  COLORS,
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
  const { bottomPadding } = useGlobalInsets();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundColor, backgroundOffset } = GetThemeColors();

  const [draft, setDraft] = useState({
    categories: currentFilter?.categories ?? DEFAULT_FILTER.categories,
    distanceUnit: currentFilter?.distanceUnit ?? DEFAULT_FILTER.distanceUnit,
  });

  useEffect(() => {
    setContentHeight(520);
  }, [setContentHeight]);

  const inactiveBorderColor =
    theme && darkModeType ? backgroundColor : backgroundOffset;
  const activeColor = theme && darkModeType ? backgroundColor : COLORS.primary;

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

  const renderPill = (isActive, label, onPress, key) => (
    <TouchableOpacity
      key={key}
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: isActive ? activeColor : 'transparent',
          borderColor: isActive ? activeColor : inactiveBorderColor,
        },
      ]}
    >
      <ThemeText
        styles={[styles.pillText, { color: isActive ? '#fff' : textColor }]}
        content={label}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <ThemeText
          styles={styles.sectionLabel}
          content={t('screens.btcMap.filter.categoriesTitle')}
        />

        <View style={styles.pillRow}>
          {renderPill(
            draft.categories.length === 0,
            t('screens.btcMap.filter.all'),
            handleSelectAllCategories,
            'all',
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
                    backgroundColor: isActive ? activeColor : 'transparent',
                    borderColor: isActive ? activeColor : inactiveBorderColor,
                  },
                ]}
              >
                <ThemeIcon
                  iconName={CATEGORY_META[category].icon}
                  size={16}
                  colorOverride={isActive ? '#fff' : textColor}
                />
                <ThemeText
                  styles={[
                    styles.pillText,
                    { color: isActive ? '#fff' : textColor },
                  ]}
                  content={t(CATEGORY_META[category].labelKey)}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View
          style={[styles.divider, { borderTopColor: inactiveBorderColor }]}
        />

        <ThemeText
          styles={styles.sectionLabel}
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

        <View style={{ height: 20 }} />
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { borderTopColor: inactiveBorderColor, paddingBottom: bottomPadding },
        ]}
      >
        <TouchableOpacity
          style={{ opacity: hasActiveSelections ? 1 : HIDDEN_OPACITY }}
          onPress={handleClear}
          activeOpacity={hasActiveSelections ? 0.2 : HIDDEN_OPACITY}
        >
          <ThemeText content={t('screens.btcMap.filter.clear')} />
        </TouchableOpacity>

        <CustomButton
          buttonStyles={styles.applyButton}
          actionFunction={handleApply}
          textContent={t('screens.btcMap.filter.apply')}
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
  sectionLabel: {
    fontSize: SIZES.small,
    marginBottom: 10,
    includeFontPadding: false,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  pillWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  divider: {
    borderTopWidth: 1,
    marginVertical: 20,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  applyButton: {
    minWidth: 135,
  },
});
