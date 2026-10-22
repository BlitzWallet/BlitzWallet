import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CountryCodeList } from 'react-native-country-picker-modal';
import { getCountryInfoAsync } from 'react-native-country-picker-modal/lib/CountryService';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import { CENTER } from '../../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { KeyboardController } from 'react-native-keyboard-controller';
import PageTitle from '../../../../../functions/CustomElements/redesign/PageTitle';
import SectionHeader from '../../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import DiscText from '../../../../../functions/CustomElements/redesign/DiscText';
import TextButton from '../../../../../functions/CustomElements/redesign/TextButton';
import { SheetSurface } from '../../../../../functions/CustomElements/redesign/sheetSurface';
import IconButton from '../../../../../functions/CustomElements/redesign/IconButton';
import SearchField from '../../../../../functions/CustomElements/redesign/SearchField';
import PickRow from '../../../../../functions/CustomElements/redesign/PickRow';

const DEFAULT_FILTER = {
  categories: [],
  countryCode: 'WW',
};

const PAGE_DURATION = 250;

function CountryListDivider() {
  const { tokens } = useGlobalThemeContext();
  return (
    <View
      style={[styles.countryDivider, { backgroundColor: tokens.divider }]}
    />
  );
}

export default function OnlineListingsFilterHalfModal({
  currentFilter,
  onSelectFilter,
  handleBackPressFunction,
  setContentHeight,
  categoryOptions = [],
  setIsKeyboardActive,
}) {
  const { t } = useTranslation();
  const filterTitle = t('apps.onlineListings.filterTitle').replace(
    /Shops$/,
    'shops',
  );
  const { textColor, backgroundColor, backgroundOffset, tokens } =
    GetThemeColors();
  const [draft, setDraft] = useState({
    categories: currentFilter?.categories ?? DEFAULT_FILTER.categories,
    countryCode: currentFilter?.countryCode ?? DEFAULT_FILTER.countryCode,
  });
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  // filter page only animates in when returning from the country picker, not on first open
  const hasOpenedCountryPicker = useRef(false);
  const [allCountries, setAllCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
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

        const countries = [
          {
            code: 'WW',
            countryName: t('apps.onlineListings.filterWorldwide'),
          },
          ...countryInfoList,
        ];
        const etheopiaIndex = countries.findIndex(item => item.code === 'ET');
        if (etheopiaIndex !== -1) {
          countries.splice(etheopiaIndex, 0, {
            code: 'EU',
            countryName: 'European Union',
          });
        }
        setAllCountries(countries);
      } finally {
        if (mounted) setLoadingCountries(false);
      }
    };

    loadCountries();
    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    setDraft({
      categories: currentFilter?.categories ?? DEFAULT_FILTER.categories,
      countryCode: currentFilter?.countryCode ?? DEFAULT_FILTER.countryCode,
    });
  }, [currentFilter]);

  useEffect(() => {
    setContentHeight(700);
  }, [setContentHeight]);

  const handleClear = useCallback(() => {
    setDraft({ categories: [], countryCode: 'WW' });
    setShowCountryPicker(false);
  }, []);

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

  const handleCountryPress = useCallback(countryCode => {
    setDraft(prev => ({ ...prev, countryCode }));
    setShowCountryPicker(false);
  }, []);

  const handleCountryBackPress = useCallback(() => {
    setShowCountryPicker(false);
    return true;
  }, []);

  return (
    <SheetSurface>
      <View style={[styles.container, { backgroundColor: backgroundOffset }]}>
        {showCountryPicker ? (
          <Animated.View
            key="country-page-fade"
            entering={FadeIn.duration(PAGE_DURATION)}
            exiting={FadeOut.duration(PAGE_DURATION)}
            style={styles.page}
          >
            <Animated.View
              key="country-page-slide"
              entering={SlideInRight.duration(PAGE_DURATION)}
              exiting={SlideOutRight.duration(PAGE_DURATION)}
              style={styles.page}
            >
              <CountryPickerPage
                selectedCountryCode={draft.countryCode}
                allCountries={allCountries}
                loadingCountries={loadingCountries}
                onSelectCountry={handleCountryPress}
                onBackPress={handleCountryBackPress}
                setIsKeyboardActive={setIsKeyboardActive}
              />
            </Animated.View>
          </Animated.View>
        ) : (
          <Animated.View
            key="filter-page-fade"
            entering={
              hasOpenedCountryPicker.current
                ? FadeIn.duration(PAGE_DURATION)
                : undefined
            }
            exiting={FadeOut.duration(PAGE_DURATION)}
            style={styles.page}
          >
            <Animated.View
              key="filter-page-slide"
              entering={
                hasOpenedCountryPicker.current
                  ? SlideInLeft.duration(PAGE_DURATION)
                  : undefined
              }
              exiting={SlideOutLeft.duration(PAGE_DURATION)}
              style={styles.page}
            >
              <View style={[styles.mainContent]}>
                <CustomScrollView
                  style={styles.scrollView}
                  showsVerticalScrollIndicator={false}
                >
                  <PageTitle text={filterTitle} titleStyles={styles.title} />

                  <SectionHeader
                    first={true}
                    title={t('apps.onlineListings.filterCategoriesTitle')}
                    style={styles.firstSection}
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
                              ? tokens.accent
                              : backgroundColor,
                        },
                      ]}
                    >
                      <ThemeText
                        styles={[
                          styles.pillText,
                          {
                            color:
                              draft.categories.length === 0
                                ? tokens.onAccent
                                : textColor,
                          },
                        ]}
                        content={t(
                          'apps.onlineListings.filterAllCategories',
                        ).replace(/^All Categories$/, 'All categories')}
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
                                ? tokens.accent
                                : backgroundColor,
                            },
                          ]}
                        >
                          <ThemeText
                            styles={[
                              styles.pillText,
                              {
                                color: isActive ? tokens.onAccent : textColor,
                              },
                            ]}
                            content={t(`apps.onlineListings.${category}`)}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <SectionHeader
                    title={t('apps.onlineListings.filterCountryTitle')}
                    style={styles.countrySection}
                  />

                  <ListCard>
                    <ListRow
                      title={
                        allCountries.find(
                          item => item.code === draft.countryCode,
                        )?.countryName ??
                        selectedCountryName(draft.countryCode, t)
                      }
                      titleStyle={styles.selectedCountryName}
                      lead={
                        draft.countryCode === 'WW' ? (
                          <Disc
                            tone="white"
                            icon="Globe"
                            size={36}
                            iconSize={18}
                          />
                        ) : (
                          <DiscText tone="white" text={draft.countryCode} />
                        )
                      }
                      trailing="chevron"
                      onPress={() => {
                        hasOpenedCountryPicker.current = true;
                        setShowCountryPicker(true);
                      }}
                      minHeight={56}
                      paddingVertical={0}
                    />
                  </ListCard>

                  <View style={{ height: 20 }} />
                </CustomScrollView>

                <View style={styles.bottomBar}>
                  <TextButton
                    text={t('apps.onlineListings.filterClear')}
                    onPress={handleClear}
                  />

                  <CustomButton
                    buttonStyles={styles.applyButton}
                    actionFunction={handleApply}
                    textContent={t('apps.onlineListings.filterApply')}
                    size="fit"
                  />
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </SheetSurface>
  );
}

function selectedCountryName(countryCode, t) {
  if (countryCode === 'WW') return t('apps.onlineListings.filterWorldwide');
  if (countryCode === 'EU') return 'European Union';
  return countryCode;
}

function CountryPickerPage({
  selectedCountryCode,
  allCountries,
  loadingCountries,
  onSelectCountry,
  onBackPress,
  setIsKeyboardActive: setModalKeyboardActive,
}) {
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const [countrySearch, setCountrySearch] = useState('');

  const handleBackPress = useCallback(() => {
    KeyboardController.dismiss();
    setModalKeyboardActive?.(false);
    return onBackPress();
  }, [onBackPress, setModalKeyboardActive]);

  useHandleBackPressNew(handleBackPress);

  const handleSelectCountry = useCallback(
    async countryCode => {
      await KeyboardController.dismiss();
      setModalKeyboardActive?.(false);
      onSelectCountry(countryCode);
    },
    [onSelectCountry, setModalKeyboardActive],
  );

  const filteredCountries = useMemo(() => {
    const normalizedSearch = countrySearch.trim().toLowerCase();
    if (!normalizedSearch) return allCountries;
    return allCountries.filter(
      item =>
        item.countryName?.toLowerCase().includes(normalizedSearch) ||
        item.code?.toLowerCase().includes(normalizedSearch),
    );
  }, [allCountries, countrySearch]);

  const renderCountryItem = useCallback(
    ({ item }) => {
      const isSelected = selectedCountryCode === item.code;
      const lead =
        item.code === 'WW' ? (
          <Disc icon="Globe" size={36} iconSize={18} tone="white" />
        ) : (
          <DiscText tone="white" text={item.code} />
        );

      return (
        <PickRow
          title={item.countryName}
          titleStyle={styles.countryName}
          lead={lead}
          selected={isSelected}
          onPress={() => handleSelectCountry(item.code)}
          paddingVertical={0}
        />
      );
    },
    [
      backgroundOffset,
      darkModeType,
      handleSelectCountry,
      selectedCountryCode,
      theme,
    ],
  );

  return (
    <View
      style={[
        styles.countryPage,
        {
          backgroundColor: backgroundOffset,
        },
      ]}
    >
      <IconButton
        icon="ArrowLeft"
        label="constants.back"
        tone={'disc'}
        onPress={handleBackPress}
      />
      <PageTitle
        text={t('apps.onlineListings.filterCountryTitle')}
        titleStyles={styles.countryTitle}
      />
      <SearchField
        value={countrySearch}
        onChangeText={setCountrySearch}
        placeholder={t('apps.onlineListings.filterCountrySearchPlaceholder')}
        pill={true}
        onFocus={() => {
          setModalKeyboardActive?.(true);
        }}
        onBlur={() => {
          setModalKeyboardActive?.(false);
        }}
      />

      {loadingCountries ? (
        <FullLoadingScreen showText={false} />
      ) : (
        <ListCard style={styles.countryListCard}>
          <FlatList
            style={styles.countryFlatList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.countryList]}
            ItemSeparatorComponent={CountryListDivider}
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
        </ListCard>
      )}
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
  page: {
    ...StyleSheet.absoluteFillObject,
  },
  mainContent: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flexGrow: 1,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 0,
    marginTop: 8,
    marginBottom: 0,
    includeFontPadding: false,
  },
  firstSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  countrySection: {
    marginTop: 20,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 0,
  },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillActive: {},
  pillInactive: {},
  pillText: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  selectedCountryName: {
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    gap: 12,
  },
  applyButton: {
    minWidth: 135,
    flex: 1,
  },
  countryPage: {
    flex: 1,
  },
  countryBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryTitle: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 0,
    marginTop: 8,
    marginBottom: 10,
    includeFontPadding: false,
  },
  searchInput: {
    width: '100%',
    borderRadius: 999,
    marginTop: 14,
    marginBottom: 12,
  },
  countrySearchInput: {
    height: 52,
    paddingLeft: 48,
    paddingRight: 16,
    paddingVertical: 0,
    borderRadius: 999,
    fontSize: 15,
    lineHeight: 22,
  },
  countrySearchIcon: {
    position: 'absolute',
    left: 16,
    top: 17,
  },
  countryList: {
    width: '100%',
    flexGrow: 1,
  },
  countryListCard: {
    flex: 1,
    marginTop: 10,
  },
  countryFlatList: {
    flex: 1,
  },
  countryFlagShell: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryName: {
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  countryDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 32,
  },
  emptyCountryText: {
    marginTop: 20,
    textAlign: 'center',
    opacity: 0.7,
  },
});
