import {
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CountryCodeList } from 'react-native-country-picker-modal';
import { getCountryInfoAsync } from 'react-native-country-picker-modal/lib/CountryService';
import CountryFlag from 'react-native-country-flag';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
} from '../../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import CheckMarkCircle from '../../../../../functions/CustomElements/checkMarkCircle';

const DEFAULT_FILTER = {
  categories: [],
  countryCode: 'WW',
};

export default function OnlineListingsFilterHalfModal({
  currentFilter,
  onSelectFilter,
  handleBackPressFunction,
  setContentHeight,
  setIsKeyboardActive,
  categoryOptions = [],
}) {
  const { t } = useTranslation();
  const { bottomPadding } = useGlobalInsets();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundColor, backgroundOffset } = GetThemeColors();
  const [draft, setDraft] = useState({
    categories: currentFilter?.categories ?? DEFAULT_FILTER.categories,
    countryCode: currentFilter?.countryCode ?? DEFAULT_FILTER.countryCode,
  });
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [allCountries, setAllCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);

  const contentOpacity = useSharedValue(1);
  const contentTranslateX = useSharedValue(0);
  const countryOpacity = useSharedValue(0);
  const countryTranslateX = useSharedValue(30);

  useEffect(() => {
    setDraft({
      categories: currentFilter?.categories ?? DEFAULT_FILTER.categories,
      countryCode: currentFilter?.countryCode ?? DEFAULT_FILTER.countryCode,
    });
  }, [currentFilter]);

  useEffect(() => {
    setContentHeight(720);
  }, [setContentHeight]);

  useEffect(() => {
    let mounted = true;

    const loadCountries = async () => {
      try {
        const countryInfoList = await Promise.all(
          CountryCodeList.map(async code => {
            const info = await getCountryInfoAsync({ countryCode: code });
            return { ...info, code };
          }),
        );

        if (!mounted) return;

        setAllCountries([
          {
            code: 'WW',
            countryName: t('apps.onlineListings.filterWorldwide'),
          },
          ...countryInfoList,
        ]);
      } finally {
        if (mounted) {
          setLoadingCountries(false);
        }
      }
    };

    loadCountries();

    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (showCountryPicker) {
      contentOpacity.value = withTiming(0, { duration: 250 });
      contentTranslateX.value = withTiming(-30, { duration: 250 });
      countryOpacity.value = withTiming(1, { duration: 250 });
      countryTranslateX.value = withTiming(0, { duration: 250 });
    } else {
      contentOpacity.value = withTiming(1, { duration: 250 });
      contentTranslateX.value = withTiming(0, { duration: 250 });
      countryOpacity.value = withTiming(0, { duration: 250 });
      countryTranslateX.value = withTiming(30, { duration: 250 });
    }
  }, [showCountryPicker]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: contentTranslateX.value }],
  }));

  const countryOverlayStyle = useAnimatedStyle(() => ({
    opacity: countryOpacity.value,
    transform: [{ translateX: countryTranslateX.value }],
  }));

  const inactiveBorderColor =
    theme && darkModeType ? backgroundColor : backgroundOffset;

  const hasActiveSelections =
    draft.categories.length > 0 ||
    draft.countryCode !== DEFAULT_FILTER.countryCode;

  const selectedCountry = useMemo(() => {
    return (
      allCountries.find(item => item.code === draft.countryCode) || {
        code: draft.countryCode,
        countryName:
          draft.countryCode === 'WW'
            ? t('apps.onlineListings.filterWorldwide')
            : draft.countryCode,
      }
    );
  }, [allCountries, draft.countryCode, t]);

  const filteredCountries = useMemo(() => {
    const normalizedSearch = countrySearch.trim().toLowerCase();

    if (!normalizedSearch) return allCountries;

    return allCountries.filter(item => {
      return (
        item.countryName?.toLowerCase().includes(normalizedSearch) ||
        item.code?.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [allCountries, countrySearch]);

  const handleClear = useCallback(() => {
    setDraft({
      categories: [],
      countryCode: 'WW',
    });
    setCountrySearch('');
    setShowCountryPicker(false);
    setIsKeyboardActive?.(false);
  }, [setIsKeyboardActive]);

  const handleApply = useCallback(() => {
    onSelectFilter({
      categories: draft.categories,
      countryCode: draft.countryCode,
    });
    handleBackPressFunction();
  }, [draft, handleBackPressFunction, onSelectFilter]);

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

  const handleCountryPress = useCallback(
    countryCode => {
      setDraft(prev => ({ ...prev, countryCode }));
      setCountrySearch('');
      setShowCountryPicker(false);
      setIsKeyboardActive?.(false);
    },
    [setIsKeyboardActive],
  );

  const handleCountryBackPress = useCallback(() => {
    if (!showCountryPicker) return false;
    setShowCountryPicker(false);
    setCountrySearch('');
    setIsKeyboardActive?.(false);
    return true;
  }, [setIsKeyboardActive, showCountryPicker]);

  useHandleBackPressNew(handleCountryBackPress);

  const renderCountryItem = useCallback(
    ({ item }) => {
      const isSelected = draft.countryCode === item.code;

      return (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => handleCountryPress(item.code)}
          style={[
            styles.countryRow,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : backgroundOffset,
              borderColor: isSelected
                ? theme && darkModeType
                  ? COLORS.darkModeText
                  : COLORS.primary
                : inactiveBorderColor,
            },
          ]}
        >
          <View style={styles.countryInfoRow}>
            <View
              style={[
                styles.countryFlagShell,
                {
                  backgroundColor:
                    item.code === 'WW'
                      ? theme && darkModeType
                        ? backgroundOffset
                        : backgroundColor
                      : 'transparent',
                },
              ]}
            >
              {item.code === 'WW' ? (
                <ThemeIcon
                  iconName="Globe"
                  size={18}
                  colorOverride={textColor}
                />
              ) : (
                <CountryFlag isoCode={item.code} size={20} />
              )}
            </View>

            <View style={styles.countryTextContainer}>
              <ThemeText
                styles={styles.countryName}
                content={item.countryName}
              />
              <ThemeText
                styles={styles.countryCode}
                content={item.code === 'WW' ? 'WW' : item.code}
              />
            </View>
          </View>

          <CheckMarkCircle
            switchDarkMode={!theme || (theme && !darkModeType)}
            containerSize={24}
            isActive={isSelected}
          />
        </TouchableOpacity>
      );
    },
    [
      backgroundColor,
      backgroundOffset,
      darkModeType,
      draft.countryCode,
      handleCountryPress,
      inactiveBorderColor,
      textColor,
      theme,
    ],
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mainContent, contentStyle]}>
        <ThemeText
          styles={styles.title}
          content={t('apps.onlineListings.filterTitle')}
        />

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <ThemeText
            styles={styles.sectionLabel}
            content={t('apps.onlineListings.filterCategoriesTitle')}
          />

          <View style={styles.pillRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleSelectAllCategories}
              style={[
                styles.pill,
                draft.categories.length === 0
                  ? styles.pillActive
                  : styles.pillInactive,
                {
                  backgroundColor:
                    draft.categories.length === 0
                      ? theme && darkModeType
                        ? backgroundColor
                        : COLORS.primary
                      : 'transparent',
                  borderColor:
                    draft.categories.length === 0
                      ? theme && darkModeType
                        ? backgroundColor
                        : COLORS.primary
                      : inactiveBorderColor,
                },
              ]}
            >
              <ThemeText
                styles={[
                  styles.pillText,
                  {
                    color: draft.categories.length === 0 ? '#fff' : textColor,
                  },
                ]}
                content={t('apps.onlineListings.filterAllCategories')}
              />
            </TouchableOpacity>

            {categoryOptions.map(category => {
              const isActive = draft.categories.includes(category);

              return (
                <TouchableOpacity
                  key={category}
                  activeOpacity={0.75}
                  onPress={() => toggleCategory(category)}
                  style={[
                    styles.pill,
                    isActive ? styles.pillActive : styles.pillInactive,
                    {
                      backgroundColor: isActive
                        ? theme && darkModeType
                          ? backgroundColor
                          : COLORS.primary
                        : 'transparent',
                      borderColor: isActive
                        ? theme && darkModeType
                          ? backgroundColor
                          : COLORS.primary
                        : inactiveBorderColor,
                    },
                  ]}
                >
                  <ThemeText
                    styles={[
                      styles.pillText,
                      { color: isActive ? '#fff' : textColor },
                    ]}
                    content={t(`apps.onlineListings.${category}`)}
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
            content={t('apps.onlineListings.filterCountryTitle')}
          />

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setShowCountryPicker(true)}
            style={[
              styles.countrySelector,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
                borderColor: inactiveBorderColor,
              },
            ]}
          >
            <View style={styles.countrySelectorLeft}>
              <View
                style={[
                  styles.countrySelectorFlag,
                  {
                    backgroundColor:
                      draft.countryCode === 'WW'
                        ? theme && darkModeType
                          ? backgroundOffset
                          : backgroundColor
                        : 'transparent',
                  },
                ]}
              >
                {draft.countryCode === 'WW' ? (
                  <ThemeIcon
                    iconName="Globe"
                    size={18}
                    colorOverride={textColor}
                  />
                ) : (
                  <CountryFlag isoCode={draft.countryCode} size={20} />
                )}
              </View>

              <View style={styles.countrySelectorTextContainer}>
                <ThemeText
                  styles={styles.countrySelectorLabel}
                  content={selectedCountry.countryName}
                />
                <ThemeText
                  styles={styles.countrySelectorValue}
                  content={draft.countryCode}
                />
              </View>
            </View>

            <ThemeIcon
              iconName="ChevronRight"
              size={18}
              colorOverride={textColor}
            />
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>

        <View
          style={[styles.bottomBar, { borderTopColor: inactiveBorderColor }]}
        >
          <TouchableOpacity
            style={{
              opacity: hasActiveSelections ? 1 : HIDDEN_OPACITY,
              flexShrink: 1,
            }}
            onPress={handleClear}
            activeOpacity={hasActiveSelections ? 0.2 : HIDDEN_OPACITY}
          >
            <ThemeText content={t('apps.onlineListings.filterClear')} />
          </TouchableOpacity>

          <CustomButton
            buttonStyles={styles.applyButton}
            actionFunction={handleApply}
            textContent={t('apps.onlineListings.filterApply')}
          />
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents={showCountryPicker ? 'auto' : 'none'}
        style={[
          styles.countryOverlay,
          {
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          },
          countryOverlayStyle,
        ]}
      >
        <View style={styles.countryOverlayHeader}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleCountryBackPress}
            style={styles.countryOverlayBack}
          >
            <ThemeIcon iconName="ArrowLeft" />
          </TouchableOpacity>
        </View>

        <CustomSearchInput
          inputText={countrySearch}
          setInputText={setCountrySearch}
          placeholderText={t(
            'apps.onlineListings.filterCountrySearchPlaceholder',
          )}
          containerStyles={styles.searchInput}
          onFocusFunction={() => setIsKeyboardActive?.(true)}
          onBlurFunction={() => setIsKeyboardActive?.(false)}
        />

        {loadingCountries ? (
          <FullLoadingScreen showText={false} />
        ) : (
          <FlatList
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.countryList,
              { paddingBottom: bottomPadding + CONTENT_KEYBOARD_OFFSET },
            ]}
            data={filteredCountries}
            renderItem={renderCountryItem}
            keyExtractor={item => item.code}
            ListEmptyComponent={
              <ThemeText
                styles={styles.emptyCountryText}
                content={t('apps.onlineListings.noBuisMessage')}
              />
            }
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    overflow: 'hidden',
  },
  mainContent: {
    flex: 1,
    width: '100%',
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
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  pillActive: {},
  pillInactive: {},
  pillText: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  divider: {
    borderTopWidth: 1,
    marginVertical: 16,
  },
  countrySelector: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  countrySelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  countrySelectorFlag: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countrySelectorTextContainer: {
    flex: 1,
  },
  countrySelectorLabel: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  countrySelectorValue: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: 0.6,
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
  countryOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  countryOverlayHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  countryOverlayBack: {
    // width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    width: '100%',
    paddingBottom: CONTENT_KEYBOARD_OFFSET,
  },
  countryList: {
    width: '100%',
    gap: 10,
  },
  countryRow: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  countryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  countryFlagShell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryTextContainer: {
    flex: 1,
  },
  countryName: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  countryCode: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: 0.6,
  },
  emptyCountryText: {
    marginTop: 20,
    textAlign: 'center',
    opacity: 0.7,
  },
});
