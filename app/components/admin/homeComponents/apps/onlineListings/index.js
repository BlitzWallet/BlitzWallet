import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { getNormalizedWebsiteUrl } from '../../../../../functions/getNormalizedWebsiteUrl';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import GetThemeColors from '../../../../../hooks/themeColors';
import {
  useGlobalThemeContext,
  useTheme,
} from '../../../../../../context-store/theme';
import { SHOPS_DIRECTORY_KEY } from '../../../../../constants';
import {
  INSET_WINDOW_WIDTH,
  WINDOWWIDTH,
} from '../../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { keyboardNavigate } from '../../../../../functions/customNavigation';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../../../../functions';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';
import openWebBrowser from '../../../../../functions/openWebBrowser';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../../functions/CustomElements/redesign/IconButton';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import SearchField from '../../../../../functions/CustomElements/redesign/SearchField';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';

const DEFAULT_FILTER = {
  categories: [],
  countryCode: 'WW',
};
const FEATURED_CATEGORY_ORDER = [
  'food & beverages',
  'services',
  'apparel',
  'travel',
  'e-commerce',
  'health',
  'tech',
  'education',
  'media',
  'charity',
];

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debounced;
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
  const reTryCounter = useRef(0);
  const { bottomPadding } = useGlobalInsets();
  const debouncedSearch = useDebouncedValue(search, 300);
  const { tokens } = useGlobalThemeContext();
  const { backgroundColor, textInputBackground } = GetThemeColors();
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
      const aIndex = FEATURED_CATEGORY_ORDER.indexOf(a);
      const bIndex = FEATURED_CATEGORY_ORDER.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
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
    ({ item }) => <BusinessCard item={item} t={t} />,
    [t],
  );

  const renderListHeader = useMemo(
    () => (
      <View style={[styles.stickySearchHeader, { backgroundColor }]}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder={t('apps.onlineListings.inputPlaceHolder')}
          pill={true}
        />
      </View>
    ),
    [backgroundColor, search, t, textInputBackground, tokens],
  );

  const emptyComponent = useMemo(
    () => (
      <EmptyState
        icon="SearchX"
        title={t('apps.onlineListings.noBuisMessage')}
      />
    ),
    [t],
  );

  if (loading) {
    return (
      <CustomKeyboardAvoidingView
        useLocalPadding={true}
        useStandardWidth={true}
      >
        <TopBar
          title={t('apps.onlineListings.topBarLabel')}
          onBack={() => keyboardNavigate(() => navigate.popTo('HomeAdmin'))}
        />
        <FullLoadingScreen text={t('apps.onlineListings.loadingShopMessage')} />
      </CustomKeyboardAvoidingView>
    );
  }

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <TopBar
        title={t('apps.onlineListings.topBarLabel')}
        onBack={() => keyboardNavigate(() => navigate.popTo('HomeAdmin'))}
        right={
          <>
            <View style={styles.filterButton}>
              <IconButton
                icon="SlidersHorizontal"
                label="apps.onlineListings.filterTitle"
                onPress={() =>
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
              {activeFilterCount > 0 && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.filterBadge,
                    { backgroundColor: tokens.accent },
                  ]}
                >
                  <ThemeText
                    content={activeFilterCount}
                    styles={[
                      styles.filterBadgeText,
                      { color: tokens.onAccent },
                    ]}
                  />
                </View>
              )}
            </View>
            <IconButton
              icon="Plus"
              label="apps.onlineListings.filterTitle"
              onPress={() =>
                openWebBrowser({
                  navigate,
                  link: 'https://bitcoinlistings.org/submit',
                })
              }
            />
          </>
        }
      />

      <FlatList
        data={businesses}
        showsVerticalScrollIndicator={false}
        keyExtractor={keyExtractor}
        style={styles.flatList}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomPadding },
        ]}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={emptyComponent}
        renderItem={renderItem}
      />
    </CustomKeyboardAvoidingView>
  );
}

const BusinessCard = React.memo(({ item, t }) => {
  const navigate = useNavigation();
  const { tokens } = useTheme();

  const websiteUrl = useMemo(
    () => getNormalizedWebsiteUrl(item.website),
    [item.website],
  );

  const handleWebsitePress = useCallback(() => {
    try {
      openWebBrowser({ navigate, link: websiteUrl });
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.genericError'),
      });
    }
  }, [websiteUrl, navigate, t]);

  const countryName =
    item.country.code === 'WW'
      ? t('apps.onlineListings.filterWorldwide')
      : item.country.name;

  return (
    <ListCard style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.businessCopy}>
          <ThemeText content={item.name?.trim()} styles={styles.title} />
          {!!item.description && (
            <ThemeText
              content={item.description}
              styles={[styles.desc, { color: tokens.muted }]}
            />
          )}
        </View>
        <View
          style={[styles.categoryContainer, { backgroundColor: tokens.disc }]}
        >
          <ThemeText content={countryName} styles={styles.countryLocation} />
        </View>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleWebsitePress}
        activeOpacity={0.8}
        accessibilityRole="link"
      >
        <View style={styles.buttonCopy}>
          <ThemeIcon
            redesign
            size={16}
            colorOverride={tokens.link}
            iconName="Globe"
          />
          <ThemeText
            content={t('apps.onlineListings.visitWebsite').replace(
              /^Visit Website$/,
              'Visit website',
            )}
            styles={[styles.buttonText, { color: tokens.link }]}
          />
        </View>

        <ThemeIcon
          redesign
          size={16}
          colorOverride={tokens.link}
          iconName="ArrowUpRight"
        />
      </TouchableOpacity>
    </ListCard>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  stickySearchHeader: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: 16,
    paddingBottom: 12,
  },
  flatList: { flex: 1, width: WINDOWWIDTH, alignSelf: 'center' },
  listContent: {
    paddingTop: 0,
    paddingBottom: 0,
    flexGrow: 1,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 12,
  },
  businessCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    includeFontPadding: false,
  },
  countryLocation: {
    includeFontPadding: false,
    fontSize: 12,
  },
  categoryContainer: {
    paddingHorizontal: 10,
    minHeight: 28,
    paddingVertical: 2,
    borderRadius: 999,
    justifyContent: 'center',
  },
  desc: {
    fontSize: 14,
    marginTop: 2,
    lineHeight: 20,
  },
  button: {
    minHeight: 48,
    paddingVertical: 0,
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
    fontSize: 14,
    includeFontPadding: false,
  },
  textInputContainer: {
    overflow: 'hidden',
    borderRadius: 999,
  },
  searchInput: {
    height: 52,
    paddingLeft: 48,
    paddingRight: 16,
    paddingVertical: 0,
    borderRadius: 999,
    fontSize: 15,
    lineHeight: 22,
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 17,
  },
  filterButton: {
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 11,
    includeFontPadding: false,
    textAlign: 'center',
  },
  submitListingBTN: {
    marginTop: 8,
    marginBottom: 12,
    alignSelf: 'center',
    width: INSET_WINDOW_WIDTH,
  },
});
