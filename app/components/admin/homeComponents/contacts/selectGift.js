import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import {useCallback, useMemo, useRef, useState} from 'react';
import {useGlobalAppData} from '../../../../../context-store/appData';
import {FlatList, StyleSheet, TouchableOpacity, View} from 'react-native';
import {formatBalanceAmount} from '../../../../functions';
import GetThemeColors from '../../../../hooks/themeColors';
import getGiftCardsList from '../apps/giftCards/giftCardAPI';
import {useTranslation} from 'react-i18next';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import {
  ICONS,
  SATSPERBITCOIN,
  SCREEN_DIMENSIONS,
  SIZES,
} from '../../../../constants';
import FastImage from 'react-native-fast-image';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {useGlobalInsets} from '../../../../../context-store/insetsProvider';
import {keyboardNavigate} from '../../../../functions/customNavigation';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import CountryFlag from 'react-native-country-flag';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import loadNewFiatData from '../../../../functions/saveAndUpdateFiatData';
import {useKeysContext} from '../../../../../context-store/keys';
import {useGlobalContextProvider} from '../../../../../context-store/context';

export default function SelectGiftCardForContacts() {
  const {masterInfoObject} = useGlobalContextProvider();
  const {decodedGiftCards, toggleGiftCardsList, giftCardsList} =
    useGlobalAppData();
  const {fiatStats} = useNodeContext();
  const navigate = useNavigation();
  const {backgroundOffset} = GetThemeColors();
  const {t} = useTranslation();
  const [errorMessage, setErrorMessage] = useState('');
  const {bottomPadding} = useGlobalInsets();
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const [isLoading, setIsLoading] = useState(null);

  useFocusEffect(
    useCallback(() => {
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
        }
      }
      console.log('Screen is focused');
      if (!giftCardsList.length) {
        loadGiftCards();
      }
    }, []),
  );

  const userLocal = decodedGiftCards?.profile?.isoCode?.toUpperCase() || 'US';
  const filteredGiftCards = useMemo(
    () =>
      giftCardsList
        .filter(
          giftCard =>
            giftCard.countries.includes(userLocal || 'US') &&
            giftCard.paymentTypes.includes('Lightning') &&
            giftCard.denominations.length !== 0 &&
            giftCard.cardType !== 'Donation' &&
            //   giftCard.denominationType === 'Variable' &&
            giftCard.stock,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [userLocal, giftCardsList],
  );

  const renderItem = useCallback(
    ({item}) => {
      const isVariable =
        item.denominationType === 'Variable' && item.denominations.length >= 2;
      return (
        <TouchableOpacity
          onPress={async () => {
            try {
              if (isLoading) return;
              setIsLoading(item.id);
              console.log(fiatStats, item.currency);
              let fiatPrice = fiatStats;
              if (fiatStats.coin.toLowerCase() != item.currency.toLowerCase()) {
                const response = await loadNewFiatData(
                  item.currency,
                  contactsPrivateKey,
                  publicKey,
                  masterInfoObject,
                );
                if (response.didWork) fiatPrice = response.fiatRateResponse;
              }

              const satsPerDollar = SATSPERBITCOIN / fiatPrice.value;

              navigate.navigate('ExpandedGiftCardPage', {
                selectedItem: item,
                fromSelectGiftPage: true,
                cardInfo: {
                  id: item.id,
                  logo: item.logo,
                  satsPerDollar,
                  fiatStats: fiatPrice,
                  name: item.name,
                },
              });

              setIsLoading(null);
            } catch (err) {
              console.log(err);
              setIsLoading(null);
            }
          }}
          activeOpacity={isLoading ? 1 : 0.2}
          style={styles.giftCardGridItem}>
          {isLoading === item.id ? (
            <FullLoadingScreen />
          ) : (
            <>
              <View style={styles.logoContainer}>
                <FastImage
                  style={styles.cardLogo}
                  source={{uri: item.logo}}
                  resizeMode={FastImage.resizeMode.contain}
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
                        )} ${item.currency}`
                      : `${formatBalanceAmount(item.denominations[0])} ${
                          item.currency
                        }`
                  }
                />
              </View>
            </>
          )}
        </TouchableOpacity>
      );
    },
    [
      navigate,
      backgroundOffset,
      fiatStats,
      contactsPrivateKey,
      publicKey,
      isLoading,
      masterInfoObject,
    ],
  );

  console.log(giftCardsList.length);

  return (
    <GlobalThemeView styles={{paddingBottom: 0}} useStandardWidth={true}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={navigate.goBack}
          style={{marginRight: 'auto'}}>
          <ThemeImage
            lightModeIcon={ICONS.smallArrowLeft}
            darkModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            keyboardNavigate(() => navigate.navigate('CountryList'))
          }>
          <CountryFlag isoCode={userLocal} size={20} />
        </TouchableOpacity>
      </View>

      {filteredGiftCards.length === 0 || errorMessage ? (
        <FullLoadingScreen
          containerStyles={{
            justifyContent:
              giftCardsList.length === 0 || !errorMessage ? 'center' : 'start',
            marginTop: giftCardsList.length === 0 || !errorMessage ? 0 : 30,
          }}
          showLoadingIcon={
            giftCardsList.length === 0 && !errorMessage ? true : false
          }
          text={
            giftCardsList.length === 0 && !errorMessage
              ? t('apps.giftCards.giftCardsPage.loadingCardsMessage')
              : errorMessage || t('contacts.selectGiftPage.noCards')
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
          ListHeaderComponent={
            <ThemeText
              styles={styles.titleText}
              content={t('contacts.selectGiftPage.header')}
            />
          }
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{
            ...styles.flatListContainer,
            paddingBottom: bottomPadding,
          }}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.row}
        />
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  globalContainer: {paddingBottom: 0},
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleText: {
    width: INSET_WINDOW_WIDTH,
    marginBottom: 10,
    textAlign: 'center',
    fontSize: SIZES.xLarge,
    alignSelf: 'center',
  },
  flatListContainer: {
    width: '100%',
    paddingBottom: 20,
    gap: 15,
    alignSelf: 'center',
    marginTop: 20,
  },
  row: {
    gap: 15,
  },
  giftCardGridItem: {
    flex: 1,
    maxWidth: SCREEN_DIMENSIONS.width * 0.3333 - 15,
    alignItems: 'center',
  },
  logoContainer: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
  expandGiftCardBTN: {
    marginLeft: 'auto',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
