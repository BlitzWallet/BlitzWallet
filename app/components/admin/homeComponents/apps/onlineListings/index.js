import React, {useEffect, useState, useMemo, useCallback, useRef} from 'react';
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
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {CENTER, COLORS, ICONS} from '../../../../../constants';
import {SIZES} from '../../../../../constants/theme';
import Icon from '../../../../../functions/CustomElements/Icon';
import {useNavigation} from '@react-navigation/native';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import DropdownMenu from '../../../../../functions/CustomElements/dropdownMenu';
import {useTranslation} from 'react-i18next';
import {keyboardNavigate} from '../../../../../functions/customNavigation';
import CustomButton from '../../../../../functions/CustomElements/button';

export default function ViewOnlineListings({removeUserLocal}) {
  const [userLocal, setUserLocal] = useState('WW');
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const reTryCounter = useRef(0);

  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const {t} = useTranslation();
  const navigate = useNavigation();

  useEffect(() => {
    if (!removeUserLocal) return;
    setUserLocal(removeUserLocal);
  }, [removeUserLocal]);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await fetch(
          'https://bitcoinlistings.org/.well-known/business',
        );
        const json = await res.json();

        if (!json.businesses && reTryCounter.current < 2) {
          fetchListings();
          reTryCounter.current += 1;
        }
        setData(json);
      } catch (e) {
        console.error('Failed to fetch listings', e);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, []);

  const businesses = useMemo(() => {
    if (!data?.businesses) return [];
    return Object.values(data.businesses)
      .filter(biz => {
        const matchSearch =
          biz.name.toLowerCase().includes(search.toLowerCase()) ||
          biz.description.toLowerCase().includes(search.toLowerCase());
        const matchCategory =
          category === 'All' ||
          biz.category?.toLowerCase() === category.toLowerCase();
        const matchLocation =
          userLocal === 'WW' ||
          biz.country?.code?.toLowerCase() === userLocal.toLowerCase();
        const usesLightning = biz.payment_methods?.lightning;
        const usesonChain = biz.payment_methods?.bitcoin_onchain;
        return (
          matchSearch &&
          matchCategory &&
          matchLocation &&
          (usesLightning || usesonChain)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, search, category, userLocal, t]);

  const dropdownData = useMemo(() => {
    const uniuqeItems = Array.from(
      new Set(data?.statistics?.categories.map(item => item.toLowerCase())),
    );
    return (
      uniuqeItems?.map(item => {
        return {label: t(`apps.onlineListings.${item}`), value: item};
      }) || []
    );
  }, [data?.statistics?.categories, t]);

  console.log(businesses, 'online buisnesses');

  const handleSelectProcess = useCallback(item => {
    if (!item) {
      setCategory('All');
    } else {
      setCategory(item.value);
    }
  }, []);

  const flatListData = businesses.length
    ? [
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
        </View>,
        ...businesses,
      ]
    : [
        <View key={'dropdown'} style={styles.dropdownContainer}>
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
        </View>,
        'plaecholder',
      ];

  if (loading) {
    return (
      <CustomKeyboardAvoidingView
        isKeyboardActive={isKeyboardActive}
        useLocalPadding={true}
        useStandardWidth={true}>
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
      globalThemeViewStyles={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            keyboardNavigate(() => navigate.popTo('HomeAdmin'));
          }}>
          <ThemeImage
            lightModeIcon={ICONS.smallArrowLeft}
            darkModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>
        <ThemeText
          styles={styles.topbarText}
          content={t('apps.onlineListings.topBarLabel')}
        />
        <TouchableOpacity
          onPress={() =>
            keyboardNavigate(() =>
              navigate.navigate('CountryList', {onlyReturn: true}),
            )
          }
          style={{
            padding: 10,
            backgroundColor:
              userLocal === 'WW'
                ? theme
                  ? backgroundOffset
                  : COLORS.darkModeText
                : 'unset',
            borderRadius: 8,
          }}>
          {userLocal === 'WW' ? (
            <Icon
              color={theme ? COLORS.darkModeText : COLORS.lightModeText}
              name={'globeIcon'}
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
        // keyExtractor={(item, idx) => item.name + idx}
        style={styles.flatList}
        contentContainerStyle={styles.listContent}
        stickyHeaderIndices={[0]} // only the search bar sticks
        ListHeaderComponent={
          <View style={[styles.stickySearchHeader, {backgroundColor}]}>
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
        renderItem={({item, index}) => {
          if (index === 0) {
            return item;
          } else if (!businesses.length) {
            return (
              <ThemeText
                key={'noItems'}
                styles={styles.noItemsText}
                content={t('apps.onlineListings.noBuisMessage')}
              />
            );
          } else {
            return (
              <View
                key={item.name + index}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme
                      ? backgroundOffset
                      : COLORS.darkModeText,
                  },
                ]}>
                <View style={styles.infoContainer}>
                  {item.country.code !== 'WW' ? (
                    <CountryFlag isoCode={item.country.code} size={20} />
                  ) : (
                    <View style={[styles.flagContainer, {backgroundColor}]}>
                      <Icon
                        color={
                          theme ? COLORS.darkModeText : COLORS.lightModeText
                        }
                        name={'globeIcon'}
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
                            theme && darkModeType
                              ? backgroundColor
                              : COLORS.primary,
                        },
                      ]}>
                      <Image
                        style={styles.lightningIcon}
                        source={ICONS.lightningReceiveIcon}
                      />
                    </View>
                  )}
                </View>
                <View style={[styles.categoryContainer, {backgroundColor}]}>
                  <ThemeText
                    styles={styles.categoryText}
                    content={t(
                      `apps.onlineListings.${item.category.toLowerCase()}`,
                    )}
                  />
                </View>
                <ThemeText content={item.description} styles={styles.desc} />
                <TouchableOpacity
                  style={[
                    styles.button,
                    {
                      borderColor: theme
                        ? COLORS.darkModeText
                        : backgroundColor,
                    },
                  ]}
                  onPress={() => {
                    Linking.openURL(item.website);
                  }}>
                  <Icon
                    color={theme ? COLORS.darkModeText : COLORS.lightModeText}
                    width={15}
                    height={15}
                    name={'globeIcon'}
                  />
                  <ThemeText
                    content={t('apps.onlineListings.visitWebsite')}
                    styles={styles.buttonText}
                  />
                </TouchableOpacity>
              </View>
            );
          }
        }}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    width: '95%',
    flexDirection: 'row',
    alignItems: 'center',
    ...CENTER,
    marginBottom: 10,
  },
  topbarText: {
    flexGrow: 1,
    textAlign: 'center',
    marginHorizontal: 5,
    fontSize: SIZES.xLarge,
  },
  stickySearchHeader: {
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 15,
  },
  dropdownContainer: {
    width: '100%',
    alignSelf: 'center',
    marginBottom: 30,
  },
  flatList: {
    flex: 1,
    width: '95%',
    alignSelf: 'center',
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  card: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  flagContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    height: 30,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameContainer: {
    flexShrink: 1,
    marginLeft: 10,
    marginRight: 10,
  },
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
  image: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  title: {
    includeFontPadding: false,
  },
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
  categoryText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  desc: {
    marginBottom: 10,
  },
  button: {
    borderWidth: 2,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    marginLeft: 5,
  },
  textStyles: {
    flexGrow: 1,
  },
  textInputContainer: {
    // marginBottom: 10,
  },
  noItemsText: {
    textAlign: 'center',
  },
  submitListingBTN: {
    marginTop: 10,
    alignSelf: 'center',
  },
});
