import {
  FlatList,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import {useCallback, useMemo, useState} from 'react';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {formatBalanceAmount} from '../../../../../functions';
import GetThemeColors from '../../../../../hooks/themeColors';
import {CENTER, COLORS, ICONS, SIZES} from '../../../../../constants';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ANDROIDSAFEAREA} from '../../../../../constants/styles';
import CountryFlag from 'react-native-country-flag';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import getGiftCardsList from './giftCardAPI';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import {keyboardNavigate} from '../../../../../functions/customNavigation';

export default function GiftCardPage() {
  const {decodedGiftCards, toggleGiftCardsList, giftCardsList} =
    useGlobalAppData();

  const {backgroundOffset} = GetThemeColors();
  const insets = useSafeAreaInsets();
  const [errorMessage, setErrorMessage] = useState('');
  const [giftCardSearch, setGiftCardSearch] = useState('');
  const navigate = useNavigation();
  const [showList, setShowList] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setShowList(true);
      async function loadGiftCards() {
        try {
          const giftCards = await getGiftCardsList();

          if (giftCards.statusCode === 400) {
            setErrorMessage(giftCards.body.error);
            return;
          }
          toggleGiftCardsList(giftCards.body.giftCards);
        } catch (err) {
          navigate.navigate('ErrorScreen', {
            errorMessage:
              'Not able to get gift cards, are you sure you are connected to the internet?',
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

  const bottomPadding = Platform.select({
    ios: insets.bottom + 20,
    android: ANDROIDSAFEAREA,
  });

  const userLocal = decodedGiftCards?.profile?.isoCode?.toUpperCase() || 'US';
  const giftCards = giftCardsList;
  useHandleBackPressNew(() => navigate.navigate('HomeAdmin'));

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

  const renderItem = useMemo(
    () =>
      ({item}) =>
        (
          <View style={styles.giftCardRowContainer}>
            <Image style={styles.cardLogo} source={{uri: item.logo}} />
            <View>
              <ThemeText
                styles={{fontWeight: '500', marginBottom: 5}}
                content={
                  item.name.length > 15
                    ? `${item.name.slice(0, 15)}...`
                    : item.name
                }
              />
              <ThemeText
                styles={{fontSize: SIZES.small}}
                content={`${
                  item[
                    item.denominations.length === 0
                      ? 'defaultDenoms'
                      : 'denominations'
                  ][0]
                } ${item.currency} ${
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
                )} ${item.currency}`}
              />
            </View>
            <TouchableOpacity
              onPress={() => {
                navigate.navigate('ExpandedGiftCardPage', {selectedItem: item});
              }}
              style={{
                ...styles.expandGiftCardBTN,
                backgroundColor: backgroundOffset,
              }}>
              <ThemeText styles={{marginLeft: 'auto'}} content={'View'} />
            </TouchableOpacity>
          </View>
        ),
    [navigate, backgroundOffset],
  );

  return (
    <GlobalThemeView styles={{paddingBottom: 0}} useStandardWidth={true}>
      <View style={{flex: 1}}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => {
              keyboardNavigate(() => navigate.navigate('HomeAdmin'));
            }}
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
          <TouchableOpacity
            style={{marginLeft: 10}}
            onPress={() =>
              keyboardNavigate(() =>
                navigate.navigate('HistoricalGiftCardPurchases'),
              )
            }>
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
          placeholderText={'Search'}
          containerStyles={{width: '90%', marginTop: 20}}
        />

        {filteredGiftCards.length === 0 || errorMessage || !showList ? (
          <FullLoadingScreen
            containerStyles={{
              justifyContent:
                giftCards.length === 0 && !errorMessage ? 'center' : 'start',
              marginTop: giftCards.length === 0 && !errorMessage ? 0 : 30,
            }}
            showLoadingIcon={
              giftCards.length === 0 && !errorMessage ? true : false
            }
            text={
              !showList
                ? `Where'd you go?`
                : giftCards.length === 0 && !errorMessage
                ? 'Getting gift cards'
                : errorMessage || 'No gift cards available'
            }
          />
        ) : (
          <FlatList
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={3}
            removeClippedSubviews={true}
            data={filteredGiftCards}
            getItemLayout={(data, index) => ({
              length: 88,
              offset: 88 * index,
              index,
            })}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()} // Assuming each gift card has a unique 'id'
            contentContainerStyle={{width: '90%', ...CENTER}}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              <View
                style={{
                  height: bottomPadding,
                }}
              />
            }
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    ...CENTER,
  },
  giftCardRowContainer: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: COLORS.gray2,
    alignItems: 'center',
  },
  cardLogo: {
    width: 55,
    height: 55,
    marginRight: 10,
    borderRadius: 10,
    resizeMode: 'contain',
  },
  expandGiftCardBTN: {
    marginLeft: 'auto',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
