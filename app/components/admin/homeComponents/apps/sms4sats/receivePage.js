import {
  FlatList,
  Keyboard,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  SIZES,
} from '../../../../../constants';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useGlobalInsets} from '../../../../../../context-store/insetsProvider';
import FastImage from 'react-native-fast-image';
import {useNavigation} from '@react-navigation/native';
import DropdownMenu from '../../../../../functions/CustomElements/dropdownMenu';
import {countrymap} from './receiveCountryCodes';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {useTranslation} from 'react-i18next';
import GetThemeColors from '../../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import sendStorePayment from '../../../../../functions/apps/payments';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';
import {useActiveCustodyAccount} from '../../../../../../context-store/activeAccount';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {encriptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import {useKeysContext} from '../../../../../../context-store/keys';
import {KEYBOARDTIMEOUT} from '../../../../../constants/styles';

const imgEndpoint = endpoint => `https://sms4sats.com/${endpoint}`;

export default function SMSMessagingReceivedPage({smsServices}) {
  const [localSMSServicesList, setLocalSMSServicesList] = useState(smsServices);
  const {publicKey, contactsPrivateKey} = useKeysContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {currentWalletMnemoinc} = useActiveCustodyAccount();
  const {sparkInformation} = useSparkWallet();
  const {t} = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const {decodedMessages, toggleGlobalAppDataInformation} = useGlobalAppData();
  const [location, setLocation] = useState(999);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const {bottomPadding} = useGlobalInsets();
  const navigate = useNavigation();
  const {backgroundColor} = GetThemeColors();
  const [isPurchasing, setIsPurchasing] = useState({
    isLoading: false,
    message: t('apps.sms4sats.sendPage.payingMessage'),
  });
  const [isLoadingLocationServices, setIsLoadingLocationServices] =
    useState(false);

  const filteredList = useMemo(() => {
    return localSMSServicesList.filter(item => {
      return item?.text?.toLowerCase().startsWith(searchInput.toLowerCase());
    });
  }, [searchInput, localSMSServicesList]);

  useEffect(() => {
    if (location === 999) {
      setLocalSMSServicesList(smsServices);
      return;
    }
    async function fetchLocationSpecificServices() {
      try {
        setIsLoadingLocationServices(true);
        const response = await fetch(
          `https://api2.sms4sats.com/getnumbersstatus?country=${location}`,
          {
            method: 'GET',
          },
        );
        const data = await response.json();

        console.log(data);
        console.log(data);
        setLocalSMSServicesList(data);
      } catch (err) {
        console.log(err);
      } finally {
        setIsLoadingLocationServices(false);
      }
    }
    fetchLocationSpecificServices();
  }, [location]);

  const handleItemSelector = useCallback(
    (serviceCode, title, imgSrc) => {
      setTimeout(
        () => {
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'confirmSMSReceive',
            serviceCode: serviceCode,
            location: location,
            title,
            imgSrc,
            getReceiveCode: handlePurchase,
            sliderHight: 0.5,
          });
        },
        Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0,
      );
      Keyboard.dismiss();
    },
    [navigate, handlePurchase, location],
  );

  const keyboardFocusFunction = useCallback(() => {
    setIsKeyboardActive(true);
  }, []);

  const keyboardBlurFunction = useCallback(() => {
    setIsKeyboardActive(false);
  }, []);

  const saveMessagesToDB = useCallback(
    messageObject => {
      const em = encriptMessage(
        contactsPrivateKey,
        publicKey,
        JSON.stringify(messageObject),
      );

      toggleGlobalAppDataInformation({messagesApp: em}, true);
    },
    [contactsPrivateKey, publicKey],
  );

  const handlePurchase = useCallback(
    async invoiceInfo => {
      try {
        setIsPurchasing(prev => ({...prev, isLoading: true}));
        let savedMessages = JSON.parse(JSON.stringify(decodedMessages));

        savedMessages.received.push({
          orderId: invoiceInfo.orderId,
          title: invoiceInfo.title,
          imgSrc: invoiceInfo.imgSrc,
          isPending: true,
          isRefunded: false,
        });

        const paymentResponse = await sendStorePayment({
          invoice: invoiceInfo.payreq,
          masterInfoObject,
          sendingAmountSats: invoiceInfo.amountSat,
          paymentType: 'lightning',
          fee: invoiceInfo.fee + invoiceInfo.supportFee,
          userBalance: sparkInformation.balance,
          sparkInformation,
          description: t('apps.sms4sats.receivePage.paymentMemo'),
          currentWalletMnemoinc: currentWalletMnemoinc,
        });
        if (!paymentResponse.didWork) throw new Error(paymentResponse.reason);

        saveMessagesToDB(savedMessages);

        navigate.navigate('ConfirmSMSReceivePage');
      } catch (err) {
        console.log('error purchasing code', err);
        navigate.navigate('ErrorScreen', {errorMessage: err.message});
      } finally {
        setIsPurchasing(prev => ({...prev, isLoading: false}));
      }
    },
    [
      sparkInformation,
      currentWalletMnemoinc,
      masterInfoObject,
      saveMessagesToDB,
      decodedMessages,
    ],
  );

  const handleSelctProcesss = useCallback(item => {
    if (typeof item !== 'number' && !item) {
      setLocation(999);
      return;
    }
    setLocation(item.value);
  }, []);

  const handleInfoPress = useCallback(() => {
    navigate.navigate('InformationPopup', {
      textContent: t('apps.sms4sats.receivePage.autoSelectInfoMessage'),
      buttonText: t('constants.understandText'),
    });
  }, [navigate]);

  const renderItem = useCallback(
    ({item, index}) => {
      if (index === 0) {
        return (
          <View style={styles.countrySelectionContainer}>
            <TouchableOpacity
              onPress={handleInfoPress}
              style={styles.selectCountryInfoContainer}>
              <ThemeText
                styles={styles.selectCountryInfoTitle}
                content={t('apps.sms4sats.receivePage.selectCountry')}
              />
              <ThemeImage
                styles={styles.selectCountryInfoImg}
                lightModeIcon={ICONS.aboutIcon}
                darkModeIcon={ICONS.aboutIcon}
                lightsOutIcon={ICONS.aboutIconWhite}
              />
            </TouchableOpacity>
            <DropdownMenu
              selectedValue={
                location == 999
                  ? t('apps.sms4sats.receivePage.autoSelect')
                  : countrymap.find(item => item.value === location)?.label
              }
              onSelect={handleSelctProcesss}
              options={countrymap}
              showClearIcon={true}
              textStyles={styles.textStyles}
              translateLabelText={false}
            />
          </View>
        );
      }

      if (index === 1) {
        return (
          <View>
            <CustomSearchInput
              inputText={searchInput}
              setInputText={setSearchInput}
              containerStyles={{...styles.itemSearch, backgroundColor}}
              onFocusFunction={keyboardFocusFunction}
              onBlurFunction={keyboardBlurFunction}
              placeholderText={t('apps.sms4sats.receivePage.inputPlaceholder')}
            />
            {filteredList.length === 0 && (
              <ThemeText
                styles={styles.noItemsText}
                content={t('apps.sms4sats.receivePage.noAvailableServices')}
              />
            )}
          </View>
        );
      }

      const serviceItem = filteredList[index - 2];
      if (!serviceItem) return null;

      return (
        <TouchableOpacity
          onPress={() =>
            handleItemSelector(
              serviceItem.value,
              serviceItem.text,
              serviceItem.image?.src,
            )
          }
          style={styles.serviceRow}>
          <FastImage
            style={styles.avatar}
            source={{uri: imgEndpoint(serviceItem.image?.src)}}
            resizeMode={FastImage.resizeMode.contain}
          />
          <ThemeText content={serviceItem.text} styles={styles.serviceText} />
        </TouchableOpacity>
      );
    },
    [
      filteredList,
      location,
      searchInput,
      handleItemSelector,
      handleInfoPress,
      handleSelctProcesss,
      keyboardFocusFunction,
      keyboardBlurFunction,
      backgroundColor,
    ],
  );

  const getItemCount = useCallback(() => {
    return filteredList.length + 2;
  }, [filteredList.length]);

  const keyExtractor = useCallback(
    (item, index) => {
      if (index === 0) return 'country-selection';
      if (index === 1) return 'search-input';
      return `service-${filteredList[index - 2]?.key}-${index}`;
    },
    [filteredList],
  );

  return (
    <View
      style={[
        styles.homepage,
        {paddingBottom: isKeyboardActive ? CONTENT_KEYBOARD_OFFSET : 0},
      ]}>
      {isPurchasing.isLoading || isLoadingLocationServices ? (
        <FullLoadingScreen
          text={
            isLoadingLocationServices
              ? t('apps.sms4sats.receivePage.loacationLoadingMessage')
              : isPurchasing.message
          }
        />
      ) : (
        <FlatList
          data={Array(getItemCount()).fill(null)}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={22}
          maxToRenderPerBatch={20}
          windowSize={3}
          contentContainerStyle={{
            paddingTop: 10,
            paddingBottom: isKeyboardActive ? 0 : bottomPadding,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  homepage: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: 10,
  },
  countrySelectionContainer: {
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  itemSearch: {
    marginTop: 0,
    marginBottom: 30,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  serviceText: {
    fontSize: SIZES.medium,
  },
  selectCountryInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  selectCountryInfoTitle: {
    marginRight: 5,
    includeFontPadding: false,
  },
  selectCountryInfoImg: {
    width: 20,
    height: 20,
  },
  textStyles: {
    flexGrow: 1,
  },
  noItemsText: {
    textAlign: 'center',
  },
});
