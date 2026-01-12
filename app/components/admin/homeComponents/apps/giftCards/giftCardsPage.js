import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import { useCallback, useMemo, useState } from 'react';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { formatBalanceAmount } from '../../../../../functions';
import GetThemeColors from '../../../../../hooks/themeColors';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  SIZES,
} from '../../../../../constants';
import CountryFlag from 'react-native-country-flag';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import getGiftCardsList from './giftCardAPI';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import { keyboardNavigate } from '../../../../../functions/customNavigation';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function GiftCardPage() {
  const { decodedGiftCards, toggleGiftCardsList, giftCardsList } =
    useGlobalAppData();
  const { masterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const [errorMessage, setErrorMessage] = useState('');
  const [giftCardSearch, setGiftCardSearch] = useState('');
  const navigate = useNavigation();
  const [showList, setShowList] = useState(false);
  const windowDimensions = useWindowDimensions();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setShowList(true);
      async function loadGiftCards() {
        try {
          const giftCards = await getGiftCardsList();

          if (giftCards.statusCode === 400) {
            setErrorMessage(t('apps.giftCards.giftCardsPage.noCardsAvailable'));
            return;
          }
          toggleGiftCardsList(giftCards.body.giftCards);
        } catch (err) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('errormessages.nointernet'),
          });
          console.log(err);
        }
      }
      console.log('Screen is focused');
      if (!giftCardsList.length) {
        loadGiftCards();
      }
      return () => {
        console.log('Screen is unfocused');
        setShowList(false);
      };
    }, []),
  );
  const { bottomPadding } = useGlobalInsets();

  const userLocal = decodedGiftCards?.profile?.isoCode?.toUpperCase() || 'US';
  const giftCards = giftCardsList;
  const handleBackPress = useCallback(() => {
    navigate.popTo('HomeAdmin');
  }, [navigate]);
  useHandleBackPressNew(handleBackPress);

  // Filter gift cards based on search input
  const filteredGiftCards = useMemo(
    () =>
      giftCards.filter(
        giftCard =>
          giftCard.countries.includes(userLocal || 'US') &&
          giftCard.name
            .toLowerCase()
            .startsWith(giftCardSearch.toLowerCase()) &&
          giftCard.paymentTypes.includes('Lightning') &&
          giftCard.denominations.length !== 0,
      ),
    [userLocal, giftCardSearch, giftCards],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const isVariable =
        item.denominationType === 'Variable' && item.denominations.length >= 2;
      return (
        <TouchableOpacity
          onPress={() => {
            navigate.navigate('ExpandedGiftCardPage', { selectedItem: item });
          }}
          style={[
            styles.giftCardGridItem,
            {
              width: (windowDimensions.width * 0.95 - 15 * 2) / 3,
            },
          ]}
        >
          <View style={styles.logoContainer}>
            <Image
              style={styles.cardLogo}
              source={{ uri: item.logo }}
              contentFit="contain"
            />
          </View>
          <View style={styles.titleContainer}>
            <ThemeText
              styles={styles.companyNameText}
              CustomNumberOfLines={1}
              content={item.name}
            />
            <ThemeText
              styles={styles.priceText}
              content={
                isVariable
                  ? `${formatBalanceAmount(
                      item.denominations.length > 1
                        ? item[
                            item.denominations.length === 0
                              ? 'defaultDenoms'
                              : 'denominations'
                          ][0]
                        : 1,
                      undefined,
                      masterInfoObject,
                    )} ${item.currency} ${
                      item.denominations.length > 1 ? '-' : ''
                    } ${formatBalanceAmount(
                      item[
                        item.denominations.length === 0
                          ? 'defaultDenoms'
                          : 'denominations'
                      ][
                        item[
                          item.denominations.length === 0
                            ? 'defaultDenoms'
                            : 'denominations'
                        ].length - 1
                      ],
                      undefined,
                      masterInfoObject,
                    )} ${item.currency}`
                  : `${formatBalanceAmount(
                      item.denominations[0],
                      undefined,
                      masterInfoObject,
                    )} ${item.currency}`
              }
            />
          </View>
        </TouchableOpacity>
      );
    },
    [
      navigate,
      backgroundOffset,
      masterInfoObject.thousandsSeperator,
      masterInfoObject.userSelectedLanguage,
    ],
  );

  return (
    <CustomKeyboardAvoidingView
      globalThemeViewStyles={{
        paddingBottom: isKeyboardActive ? CONTENT_KEYBOARD_OFFSET : 0,
      }}
      useStandardWidth={true}
    >
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            keyboardNavigate(() => navigate.popTo('HomeAdmin'));
          }}
          style={{ marginRight: 'auto' }}
        >
          <ThemeIcon iconName={'ArrowLeft'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            keyboardNavigate(() => navigate.navigate('CountryList'))
          }
        >
          <CountryFlag isoCode={userLocal} size={20} />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ marginLeft: 10 }}
          onPress={() =>
            keyboardNavigate(() =>
              navigate.navigate('HistoricalGiftCardPurchases'),
            )
          }
        >
          <ThemeImage
            darkModeIcon={ICONS.receiptIcon}
            lightModeIcon={ICONS.receiptIcon}
            lightsOutIcon={ICONS.receiptWhite}
          />
        </TouchableOpacity>
      </View>
      <CustomSearchInput
        inputText={giftCardSearch}
        setInputText={setGiftCardSearch}
        placeholderText={t('apps.giftCards.giftCardsPage.searchPlaceholder')}
        containerStyles={{
          marginTop: 20,
          paddingBottom: CONTENT_KEYBOARD_OFFSET,
        }}
        onFocusFunction={() => setIsKeyboardActive(true)}
        onBlurFunction={() => setIsKeyboardActive(false)}
      />

      {filteredGiftCards.length === 0 || errorMessage || !showList ? (
        <FullLoadingScreen
          containerStyles={{
            justifyContent:
              giftCards.length === 0 && !errorMessage ? 'center' : 'flex-start',
            marginTop: giftCards.length === 0 && !errorMessage ? 0 : 30,
          }}
          showLoadingIcon={
            giftCards.length === 0 && !errorMessage ? true : false
          }
          text={
            !showList
              ? t('apps.giftCards.giftCardsPage.leftPageMessage')
              : giftCards.length === 0 && !errorMessage
              ? t('apps.giftCards.giftCardsPage.loadingCardsMessage')
              : errorMessage
          }
        />
      ) : (
        <FlatList
          numColumns={3}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={3}
          data={filteredGiftCards}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{
            ...styles.flatListContainer,
            paddingBottom: bottomPadding,
          }}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.row}
        />
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  globalContainer: { paddingBottom: 0 },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    ...CENTER,
  },
  flatListContainer: {
    width: '100%',
    gap: 15,
    alignSelf: 'center',
    paddingTop: 20,
  },
  row: {
    gap: 15,
  },
  giftCardGridItem: {
    alignItems: 'center',
  },
  logoContainer: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.darkModeText,
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
  },
  cardLogo: {
    width: '100%',
    height: '100%',
    maxWidth: 80,
    maxHeight: 80,
    borderRadius: 12,
  },
  titleContainer: {
    alignItems: 'center',
    width: '100%',
  },
  companyNameText: {
    fontWeight: '500',
    fontSize: SIZES.small,
    textAlign: 'center',
    marginBottom: 4,
  },
  priceText: {
    fontSize: SIZES.xSmall,
    textAlign: 'center',
    opacity: 0.8,
    includeFontPadding: false,
  },
});
