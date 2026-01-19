import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
} from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import CountryFlag from 'react-native-country-flag';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  SHOPS_DIRECTORY_KEY,
} from '../../../../../constants';
import { SIZES } from '../../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import DropdownMenu from '../../../../../functions/CustomElements/dropdownMenu';
import { useTranslation } from 'react-i18next';
import { keyboardNavigate } from '../../../../../functions/customNavigation';
import CustomButton from '../../../../../functions/CustomElements/button';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../../../../functions';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

export default function ViewOnlineListings({ removeUserLocal }) {
  const [userLocal, setUserLocal] = useState('WW');
  const { decodedGiftCards } = useGlobalAppData();
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const reTryCounter = useRef(0);
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();
  const navigate = useNavigation();

  useEffect(() => {
    if (!removeUserLocal) return;
    setLocalStorageItem(SHOPS_DIRECTORY_KEY, removeUserLocal);
    setUserLocal(removeUserLocal);
  }, [removeUserLocal]);
  useEffect(() => {
    let mounted = true;
    const fetchListings = async () => {
      try {
        const [shopSavedLocation, res] = await Promise.all([
          getLocalStorageItem(SHOPS_DIRECTORY_KEY),
          fetch('https://bitcoinlistings.org/.well-known/business'),
        ]);
        if (shopSavedLocation) {
          setUserLocal(shopSavedLocation);
        } else if (decodedGiftCards?.profile?.isoCode) {
          setUserLocal(decodedGiftCards.profile.isoCode);
        }
        const json = await res.json();
        if (!json.businesses && reTryCounter.current < 2) {
          fetchListings();
          reTryCounter.current += 1;
        }
        if (!mounted) return;
        setData(json);
      } catch (e) {
        console.error('Failed to fetch listings', e);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
    return () => {
      mounted = false;
    };
  }, []);

  // Preprocess businesses once (lowercased fields, sorted)
  const preprocessedBusinesses = useMemo(() => {
    if (!data?.businesses) return [];
    return Object.values(data.businesses)
      .map(biz => ({
        ...biz,
        _name: biz.name.toLowerCase(),
        _description: biz.description?.toLowerCase() || '',
        _category: biz.category?.toLowerCase() || '',
        _countryCode: biz.country?.code?.toLowerCase() || '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // Build category dropdown data
  const dropdownData = useMemo(() => {
    const uniqueItems = Array.from(
      new Set(data?.statistics?.categories.map(item => item.toLowerCase())),
    );
    const mappedItems =
      uniqueItems?.map(item => {
        return { label: t(`apps.onlineListings.${item}`), value: item };
      }) || [];
    return mappedItems.sort((a, b) => {
      if (a.value === 'other' && b.value === 'other') return 0;
      if (a.value === 'other') return 1;
      if (b.value === 'other') return -1;
      return a.label.localeCompare(b.label);
    });
  }, [data?.statistics?.categories, t]);

  const businesses = useMemo(() => {
    if (!preprocessedBusinesses.length) return [];
    const query = debouncedSearch.toLowerCase();
    return preprocessedBusinesses.filter(biz => {
      const matchSearch =
        !query || biz._name.includes(query) || biz._description.includes(query);
      const matchCategory =
        category === 'All' || biz._category === category.toLowerCase();
      const matchLocation =
        userLocal === 'WW' || biz._countryCode === userLocal.toLowerCase();
      const acceptsBitcoin =
        biz.payment_methods?.lightning || biz.payment_methods?.bitcoin_onchain;
      return matchSearch && matchCategory && matchLocation && acceptsBitcoin;
    });
  }, [preprocessedBusinesses, debouncedSearch, category, userLocal]);

  const handleSelectProcess = useCallback(item => {
    if (!item) {
      setCategory('All');
    } else {
      setCategory(item.value);
    }
  }, []);

  const dropdownComponent = useMemo(
    () => (
      <View style={styles.dropdownContainer}>
        <DropdownMenu
          selectedValue={
            category?.toLowerCase() === 'all'
              ? t('apps.onlineListings.selectCategoryPlaceholder')
              : t(`apps.onlineListings.${category}`)
          }
          onSelect={handleSelectProcess}
          options={dropdownData}
          showClearIcon={true}
          textStyles={styles.textStyles}
          translateLabelText={false}
        />
      </View>
    ),
    [category, handleSelectProcess, dropdownData, t],
  );

  const noItemsComponent = useMemo(
    () => (
      <ThemeText
        key={'noItems'}
        styles={styles.noItemsText}
        content={t('apps.onlineListings.noBuisMessage')}
      />
    ),
    [t],
  );

  const flatListData = useMemo(() => {
    return businesses.length
      ? [dropdownComponent, ...businesses]
      : [dropdownComponent, 'placeholder'];
  }, [businesses, dropdownComponent]);

  const renderItem = useCallback(
    ({ item, index }) => {
      if (index === 0) {
        return item;
      } else if (!businesses.length) {
        return noItemsComponent;
      } else {
        return (
          <BusinessCard
            item={item}
            index={index}
            theme={theme}
            darkModeType={darkModeType}
            backgroundColor={backgroundColor}
            backgroundOffset={backgroundOffset}
            t={t}
          />
        );
      }
    },
    [
      businesses.length,
      noItemsComponent,
      theme,
      darkModeType,
      backgroundColor,
      backgroundOffset,
      t,
    ],
  );

  const keyExtractor = useCallback((item, index) => {
    if (index === 0) return 'dropdown';
    if (typeof item === 'string') return item;
    return item.name + index;
  }, []);

  if (loading) {
    return (
      <CustomKeyboardAvoidingView
        isKeyboardActive={isKeyboardActive}
        useLocalPadding={true}
        useStandardWidth={true}
      >
        <CustomSettingsTopBar label={t('apps.onlineListings.topBarLabel')} />
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
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            keyboardNavigate(() => navigate.popTo('HomeAdmin'));
          }}
        >
          <ThemeIcon iconName={'ArrowLeft'} />
        </TouchableOpacity>
        <ThemeText
          styles={styles.topbarText}
          content={t('apps.onlineListings.topBarLabel')}
        />
        <TouchableOpacity
          onPress={() =>
            keyboardNavigate(() =>
              navigate.navigate('CountryList', {
                onlyReturn: true,
                pageName: 'AppStorePageIndex',
              }),
            )
          }
          style={{
            width: 30,
            height: 30,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              userLocal === 'WW'
                ? theme
                  ? backgroundOffset
                  : COLORS.darkModeText
                : 'unset',
            borderRadius: 8,
          }}
        >
          {userLocal === 'WW' ? (
            <ThemeIcon
              size={15}
              colorOverride={theme ? COLORS.darkModeText : COLORS.lightModeText}
              iconName={'Globe'}
            />
          ) : (
            <CountryFlag isoCode={userLocal} size={20} />
          )}
        </TouchableOpacity>
      </View>

      {/* FlatList with Sticky Search Header */}
      <FlatList
        data={flatListData}
        showsVerticalScrollIndicator={false}
        keyExtractor={keyExtractor}
        style={styles.flatList}
        contentContainerStyle={styles.listContent}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
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
        }
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

// BusinessCard (unchanged except memoization)
const BusinessCard = React.memo(
  ({
    item,
    index,
    theme,
    darkModeType,
    backgroundColor,
    backgroundOffset,
    t,
  }) => {
    const handleWebsitePress = useCallback(() => {
      Linking.openURL(item.website);
    }, [item.website]);

    return (
      <View
        key={item.name + index}
        style={[
          styles.card,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          },
        ]}
      >
        <View style={styles.infoContainer}>
          {item.country.code !== 'WW' ? (
            <CountryFlag isoCode={item.country.code} size={20} />
          ) : (
            <View style={[styles.flagContainer, { backgroundColor }]}>
              <ThemeIcon
                size={15}
                colorOverride={
                  theme ? COLORS.darkModeText : COLORS.lightModeText
                }
                iconName={'Globe'}
              />
            </View>
          )}
          <View style={styles.nameContainer}>
            <ThemeText content={item.name} styles={styles.title} />
            <ThemeText
              content={item.country.name}
              styles={styles.countryLocation}
            />
          </View>
          {item.payment_methods?.lightning && (
            <View
              style={[
                styles.usesLightningContainer,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : COLORS.primary,
                },
              ]}
            >
              <Image
                style={styles.lightningIcon}
                source={ICONS.lightningReceiveIcon}
              />
            </View>
          )}
        </View>
        <View style={[styles.categoryContainer, { backgroundColor }]}>
          <ThemeText
            styles={styles.categoryText}
            content={t(`apps.onlineListings.${item.category.toLowerCase()}`)}
          />
        </View>
        <ThemeText content={item.description} styles={styles.desc} />
        <TouchableOpacity
          style={[
            styles.button,
            {
              borderColor: theme ? COLORS.darkModeText : backgroundColor,
            },
          ]}
          onPress={handleWebsitePress}
        >
          <ThemeIcon
            size={15}
            colorOverride={theme ? COLORS.darkModeText : COLORS.lightModeText}
            iconName={'Globe'}
          />
          <ThemeText
            content={t('apps.onlineListings.visitWebsite')}
            styles={styles.buttonText}
          />
        </TouchableOpacity>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  topbarText: {
    flexGrow: 1,
    textAlign: 'center',
    marginHorizontal: 5,
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  stickySearchHeader: {
    width: '100%',
    alignSelf: 'center',
    paddingBottom: CONTENT_KEYBOARD_OFFSET,
  },
  dropdownContainer: {
    width: '100%',
    alignSelf: 'center',
    marginBottom: 30,
    maxHeight: 100,
  },
  flatList: { flex: 1, width: '95%', alignSelf: 'center' },
  listContent: { paddingTop: 10, paddingBottom: 20 },
  card: { borderRadius: 8, padding: 10, marginBottom: 12 },
  flagContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    height: 30,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: { flexDirection: 'row', alignItems: 'center' },
  nameContainer: { flexShrink: 1, marginLeft: 10, marginRight: 10 },
  usesLightningContainer: {
    width: 30,
    height: 30,
    borderRadius: 25,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginLeft: 'auto',
  },
  lightningIcon: {
    width: '70%',
    height: '70%',
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  title: { includeFontPadding: false },
  countryLocation: {
    marginTop: 0,
    includeFontPadding: false,
    opacity: 0.7,
    fontSize: SIZES.small,
  },
  categoryContainer: {
    marginVertical: 15,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 'auto',
  },
  categoryText: { fontSize: SIZES.small, includeFontPadding: false },
  desc: { marginBottom: 10 },
  button: {
    borderWidth: 2,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: { marginLeft: 5 },
  textStyles: { flexGrow: 1 },
  noItemsText: { textAlign: 'center' },
  submitListingBTN: { marginTop: CONTENT_KEYBOARD_OFFSET, alignSelf: 'center' },
});
