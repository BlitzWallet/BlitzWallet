import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import {
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  SHOPS_DIRECTORY_KEY,
} from '../../../../../constants';
import {
  INSET_WINDOW_WIDTH,
  SIZES,
  WINDOWWIDTH,
} from '../../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { keyboardNavigate } from '../../../../../functions/customNavigation';
import CustomButton from '../../../../../functions/CustomElements/button';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../../../../functions';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import NoContentSceen from '../../../../../functions/CustomElements/noContentScreen';

const DEFAULT_FILTER = {
  categories: [],
  countryCode: 'WW',
};

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debounced;
}

function getNormalizedWebsiteUrl(website) {
  if (!website) return '';
  return website.startsWith('http') ? website : `https://${website}`;
}

function getWebsiteHost(website) {
  try {
    return new URL(getNormalizedWebsiteUrl(website)).hostname.replace(
      /^www\./,
      '',
    );
  } catch {
    return '';
  }
}

export default function ViewOnlineListings({ removeUserLocal }) {
  const { decodedGiftCards } = useGlobalAppData();
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [currentFilter, setCurrentFilter] = useState(DEFAULT_FILTER);
  const [loading, setLoading] = useState(true);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const reTryCounter = useRef(0);
  const debouncedSearch = useDebouncedValue(search, 300);
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();
  const navigate = useNavigation();

  useEffect(() => {
    if (!removeUserLocal) return;

    setLocalStorageItem(SHOPS_DIRECTORY_KEY, removeUserLocal);
    setCurrentFilter(prev => ({
      ...prev,
      countryCode: removeUserLocal,
    }));
  }, [removeUserLocal]);

  useEffect(() => {
    let mounted = true;

    const fetchListings = async () => {
      try {
        const [shopSavedLocation, res] = await Promise.all([
          getLocalStorageItem(SHOPS_DIRECTORY_KEY),
          fetch('https://bitcoinlistings.org/.well-known/business'),
        ]);

        const resolvedCountryCode =
          shopSavedLocation || decodedGiftCards?.profile?.isoCode || 'WW';

        if (mounted) {
          setCurrentFilter(prev => ({
            ...prev,
            countryCode: resolvedCountryCode,
          }));
        }

        const json = await res.json();

        if (!json.businesses && reTryCounter.current < 2) {
          reTryCounter.current += 1;
          fetchListings();
        }

        if (!mounted) return;
        setData(json);
      } catch (e) {
        console.error('Failed to fetch listings', e);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchListings();

    return () => {
      mounted = false;
    };
  }, [decodedGiftCards?.profile?.isoCode]);

  const preprocessedBusinesses = useMemo(() => {
    if (!data?.businesses) return [];

    return Object.values(data.businesses)
      .map(biz => ({
        ...biz,
        _name: biz.name.toLowerCase(),
        _description: biz.description?.toLowerCase() || '',
        _category: biz.category?.toLowerCase() || '',
        _countryCode: biz.country?.code?.toLowerCase() || '',
        _websiteHost: getWebsiteHost(biz.website),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const categoryOptions = useMemo(() => {
    const uniqueItems = Array.from(
      new Set(
        (data?.statistics?.categories || []).map(item => item.toLowerCase()),
      ),
    );

    return uniqueItems.sort((a, b) => {
      if (a === 'other' && b === 'other') return 0;
      if (a === 'other') return 1;
      if (b === 'other') return -1;
      return t(`apps.onlineListings.${a}`).localeCompare(
        t(`apps.onlineListings.${b}`),
      );
    });
  }, [data?.statistics?.categories, t]);

  const businesses = useMemo(() => {
    if (!preprocessedBusinesses.length) return [];

    const query = debouncedSearch.toLowerCase();

    return preprocessedBusinesses.filter(biz => {
      const matchesSearch =
        !query || biz._name.includes(query) || biz._description.includes(query);
      const matchesCategory =
        currentFilter.categories.length === 0 ||
        currentFilter.categories.includes(biz._category);
      const matchesLocation =
        currentFilter.countryCode === 'WW' ||
        biz._countryCode === currentFilter.countryCode.toLowerCase();
      const acceptsBitcoin =
        biz.payment_methods?.lightning || biz.payment_methods?.bitcoin_onchain;

      return (
        matchesSearch && matchesCategory && matchesLocation && acceptsBitcoin
      );
    });
  }, [currentFilter, debouncedSearch, preprocessedBusinesses]);

  const activeFilterCount =
    currentFilter.categories.length +
    (currentFilter.countryCode !== 'WW' ? 1 : 0);

  const handleFilterApply = useCallback(filters => {
    setCurrentFilter(filters);
    setLocalStorageItem(SHOPS_DIRECTORY_KEY, filters.countryCode);
  }, []);

  const keyExtractor = useCallback((item, index) => {
    return `${item.name}-${index}`;
  }, []);

  const renderItem = useCallback(
    ({ item }) => (
      <BusinessCard
        item={item}
        theme={theme}
        darkModeType={darkModeType}
        backgroundColor={backgroundColor}
        backgroundOffset={backgroundOffset}
        t={t}
      />
    ),
    [backgroundColor, backgroundOffset, darkModeType, t, theme],
  );

  const renderListHeader = useMemo(
    () => (
      <View style={[styles.stickySearchHeader, { backgroundColor }]}>
        <CustomSearchInput
          inputText={search}
          setInputText={setSearch}
          placeholderText={t('apps.onlineListings.inputPlaceHolder')}
          onBlurFunction={() => setIsKeyboardActive(false)}
          onFocusFunction={() => setIsKeyboardActive(true)}
          containerStyles={styles.textInputContainer}
        />
      </View>
    ),
    [backgroundColor, search, t],
  );

  const emptyComponent = useMemo(
    () => (
      <NoContentSceen
        iconName="SearchX"
        titleText={t('apps.onlineListings.noBuisMessage')}
      />
    ),
    [backgroundColor, backgroundOffset, darkModeType, t, theme],
  );

  if (loading) {
    return (
      <CustomKeyboardAvoidingView
        isKeyboardActive={isKeyboardActive}
        useLocalPadding={true}
        useStandardWidth={true}
      >
        <CustomSettingsTopBar
          label={t('apps.onlineListings.topBarLabel')}
          customBackFunction={() =>
            keyboardNavigate(() => navigate.popTo('HomeAdmin'))
          }
        />
        <FullLoadingScreen text={t('apps.onlineListings.loadingShopMessage')} />
      </CustomKeyboardAvoidingView>
    );
  }

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useStandardWidth={true}
      globalThemeViewStyles={styles.container}
    >
      <CustomSettingsTopBar
        label={t('apps.onlineListings.topBarLabel')}
        customBackFunction={() =>
          keyboardNavigate(() => navigate.popTo('HomeAdmin'))
        }
        showLeftImage={true}
        iconNew="SlidersHorizontal"
        badgeCount={activeFilterCount}
        leftImageFunction={() =>
          keyboardNavigate(() =>
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'onlineListingsFilter',
              sliderHight: 0.72,
              currentFilter,
              categoryOptions,
              onSelectFilter: filters => handleFilterApply(filters),
            }),
          )
        }
      />

      <FlatList
        data={businesses}
        showsVerticalScrollIndicator={false}
        keyExtractor={keyExtractor}
        style={styles.flatList}
        contentContainerStyle={styles.listContent}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={emptyComponent}
        renderItem={renderItem}
      />

      {!isKeyboardActive && (
        <CustomButton
          actionFunction={() =>
            Linking.openURL('https://bitcoinlistings.org/submit')
          }
          buttonStyles={styles.submitListingBTN}
          textContent={t('apps.onlineListings.addListing')}
        />
      )}
    </CustomKeyboardAvoidingView>
  );
}

const BusinessCard = React.memo(
  ({ item, theme, darkModeType, backgroundColor, backgroundOffset, t }) => {
    const websiteUrl = useMemo(
      () => getNormalizedWebsiteUrl(item.website),
      [item.website],
    );

    const handleWebsitePress = useCallback(() => {
      Linking.openURL(websiteUrl);
    }, [websiteUrl]);

    const cardBackgroundColor = theme ? backgroundOffset : COLORS.darkModeText;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardBackgroundColor,
          },
        ]}
      >
        <View style={styles.cardHeaderMain}>
          <View style={styles.nameContainer}>
            <View style={{ flex: 1 }}>
              <ThemeText content={item.name?.trim()} styles={styles.title} />
              <ThemeText content={item.description} styles={styles.desc} />
            </View>
            <View style={[styles.categoryContainer, { backgroundColor }]}>
              <ThemeText
                content={item.country.name}
                styles={styles.countryLocation}
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            {
              paddingTop: item?.description ? 24 : 0,
            },
          ]}
          onPress={handleWebsitePress}
          activeOpacity={0.8}
        >
          <View style={styles.buttonCopy}>
            <ThemeIcon
              size={16}
              colorOverride={theme ? COLORS.darkModeText : COLORS.lightModeText}
              iconName="Globe"
            />
            <ThemeText
              content={t('apps.onlineListings.visitWebsite')}
              styles={styles.buttonText}
            />
          </View>

          <ThemeIcon
            size={16}
            colorOverride={theme ? COLORS.darkModeText : COLORS.lightModeText}
            iconName="ArrowUpRight"
          />
        </TouchableOpacity>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  stickySearchHeader: {
    width: '100%',
    alignSelf: 'center',
    paddingBottom: CONTENT_KEYBOARD_OFFSET,
  },
  flatList: { flex: 1, width: WINDOWWIDTH, alignSelf: 'center' },
  listContent: {
    paddingTop: 10,
    paddingBottom: 24,
    flexGrow: 1,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  flagShell: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameContainer: {
    flex: 1,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  countryLocation: {
    marginTop: 2,
    includeFontPadding: false,
    opacity: 0.7,
    fontSize: SIZES.small,
  },
  categoryContainer: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  categoryText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  domainChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  domainChipText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: 0.7,
  },
  desc: {
    fontSize: SIZES.small,
    marginTop: 8,

    lineHeight: 22,
    opacity: 0.85,
  },
  button: {
    paddingTop: 24,
    borderRadius: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  buttonCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  buttonText: {
    includeFontPadding: false,
  },
  textInputContainer: {
    overflow: 'hidden',
  },
  emptyStateCard: {
    marginTop: 24,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyStateIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyStateTitle: {
    textAlign: 'center',
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  emptyStateSubtitle: {
    marginTop: 6,
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  submitListingBTN: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
    alignSelf: 'center',
    width: INSET_WINDOW_WIDTH,
  },
});
