import {
  FlatList,
  Keyboard,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  SCREEN_DIMENSIONS,
  SIZES,
} from '../../../../../constants';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {COLORS} from '../../../../../constants/theme';
import {useCallback, useEffect, useMemo, useState} from 'react';
import FastImage from 'react-native-fast-image';
import {useNavigation} from '@react-navigation/native';
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
import {keyboardNavigate} from '../../../../../functions/customNavigation';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import Icon from '../../../../../functions/CustomElements/Icon';
import CountryFlag from 'react-native-country-flag';
import {useGlobalInsets} from '../../../../../../context-store/insetsProvider';

const imgEndpoint = endpoint => `https://sms4sats.com/${endpoint}`;

export default function SMSMessagingReceivedPage(props) {
  const removeUserLocal = props.route.params?.removeUserLocal;
  const [userLocal, setUserLocal] = useState({iso: 'WW', value: 999});
  const smsServices = props.route.params?.smsServices || [];
  const [localSMSServicesList, setLocalSMSServicesList] = useState(smsServices);
  const {publicKey, contactsPrivateKey} = useKeysContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {currentWalletMnemoinc} = useActiveCustodyAccount();
  const {sparkInformation} = useSparkWallet();
  const {t} = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const {decodedMessages, toggleGlobalAppDataInformation} = useGlobalAppData();
  const {theme} = useGlobalThemeContext();
  const {bottomPadding} = useGlobalInsets();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const navigate = useNavigation();
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const [isPurchasing, setIsPurchasing] = useState({
    isLoading: false,
    message: t('apps.sms4sats.sendPage.payingMessage'),
  });
  const [isLoadingLocationServices, setIsLoadingLocationServices] =
    useState(false);

  useEffect(() => {
    if (!removeUserLocal) return;
    const value = countrymap.find(item => item.iso === removeUserLocal);
    if (value) setUserLocal({value: value.value, iso: value.iso});
    else setUserLocal({value: 999, iso: 'WW'});
  }, [removeUserLocal]);

  const filteredList = useMemo(() => {
    return localSMSServicesList.filter(item => {
      return item?.text?.toLowerCase().startsWith(searchInput.toLowerCase());
    });
  }, [searchInput, localSMSServicesList]);

  useEffect(() => {
    if (userLocal.value === 999) {
      setLocalSMSServicesList(smsServices);
      return;
    }
    async function fetchLocationSpecificServices() {
      try {
        setIsLoadingLocationServices(true);
        const response = await fetch(
          `https://api2.sms4sats.com/getnumbersstatus?country=${userLocal.value}`,
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
  }, [userLocal]);

  const handleItemSelector = useCallback(
    (serviceCode, title, imgSrc) => {
      setTimeout(
        () => {
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'confirmSMSReceive',
            serviceCode: serviceCode,
            location: userLocal.value,
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
    [navigate, handlePurchase, userLocal],
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
      let savedMessages = null;
      try {
        setIsPurchasing(prev => ({...prev, isLoading: true}));
        savedMessages = JSON.parse(JSON.stringify(decodedMessages));

        const pendingOrder = {
          orderId: invoiceInfo.orderId,
          title: invoiceInfo.title,
          imgSrc: invoiceInfo.imgSrc,
          isPending: true,
          isRefunded: false,
        };

        savedMessages.received = [...savedMessages.received, pendingOrder];

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
        setIsPurchasing(prev => ({
          ...prev,
          message: t('apps.sms4sats.receivePage.orderDetailsLoading'),
        }));

        let maxRunCount = 5;
        let runCount = 0;
        let responseInfo = null;
        while (runCount < maxRunCount) {
          setIsPurchasing(prev => ({
            ...prev,
            message: t('apps.VPN.VPNPlanPage.runningTries', {
              runCount: runCount,
              maxTries: maxRunCount,
            }),
          }));
          try {
            const response = await fetch(
              `https://api2.sms4sats.com/orderstatus?orderId=${invoiceInfo.orderId}`,
            );
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const responseData = await response.json();
            if (responseData.number && responseData.country) {
              responseInfo = responseData;
              break;
            } else {
              await new Promise(res => setTimeout(res, 5000));
            }
          } catch (err) {
            console.log('Error fetching order details', err);
            await new Promise(res => setTimeout(res, 5000));
          } finally {
            runCount += 1;
          }
        }

        if (!responseInfo) {
          try {
            const response = await fetch(
              `https://api2.sms4sats.com/cancelorder?orderId=${invoiceInfo.orderId}`,
            );
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const responseData = await response.json();
            console.log('cancel order response info', responseData);
            if (responseData.status === 'OK') {
              navigate.navigate('ConfirmSMSReceivePage', {
                didSucceed: true,
                isRefund: true,
              });
            } else {
              navigate.navigate('ConfirmSMSReceivePage', {
                didSucceed: false,
                isRefund: true,
              });
            }
          } catch (err) {
            console.log('error canceling order', err);
            navigate.navigate('ConfirmSMSReceivePage', {
              didSucceed: false,
              isRefund: true,
            });
          }
          return;
        }

        const finalMessages = {
          ...savedMessages,
          received: savedMessages.received.map(item => {
            if (item.orderId === invoiceInfo.orderId) {
              return {
                ...item,
                number: responseInfo.number,
                country: responseInfo.country,
                timestamp: responseInfo.timestamp,
              };
            }
            return item;
          }),
        };
        saveMessagesToDB(finalMessages);

        navigate.navigate('ConfirmSMSReceivePage', {
          didSucceed: true,
          isRefund: false,
          number: responseInfo.number,
        });
      } catch (err) {
        console.log('error purchasing code', err);
        navigate.navigate('ErrorScreen', {errorMessage: err.message});
      } finally {
        setIsPurchasing(prev => ({
          ...prev,
          isLoading: false,
          message: t('apps.sms4sats.sendPage.payingMessage'),
        }));
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
      setUserLocal(prev => ({...prev, value: 999}));
      return;
    }
    setUserLocal(prev => ({...prev, value: item.value}));
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

      const serviceItem = filteredList[index - 1];
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
      userLocal,
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
    return filteredList.length + 1;
  }, [filteredList.length]);

  const keyExtractor = useCallback(
    (item, index) => {
      if (index === 0) return 'search-input';
      return `service-${filteredList[index - 1]?.key}-${index}`;
    },
    [filteredList],
  );

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={true}
      globalThemeViewStyles={{
        paddingBottom: isKeyboardActive ? CONTENT_KEYBOARD_OFFSET : 0,
      }}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            keyboardNavigate(() => navigate.goBack());
          }}>
          <ThemeImage
            lightModeIcon={ICONS.smallArrowLeft}
            darkModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>

        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.topbarText}
          content={t('constants.receive')}
        />

        <TouchableOpacity
          onPress={() =>
            keyboardNavigate(() =>
              navigate.navigate('CountryList', {
                onlyReturn: true,
                pageName: 'SMSMessagingReceivedPage',
              }),
            )
          }
          style={{
            width: 30,
            height: 30,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              userLocal.iso === 'WW'
                ? theme
                  ? backgroundOffset
                  : COLORS.darkModeText
                : 'unset',
            borderRadius: 8,
            marginRight: 5,
            marginLeft: 'auto',
          }}>
          {userLocal.iso === 'WW' ? (
            <Icon
              width={15}
              height={15}
              color={theme ? COLORS.darkModeText : COLORS.lightModeText}
              name={'globeIcon'}
            />
          ) : (
            <CountryFlag isoCode={userLocal.iso} size={20} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            navigate.navigate('HistoricalSMSMessagingPage', {
              selectedPage: 'receive',
            })
          }>
          <ThemeImage
            lightModeIcon={ICONS.receiptIcon}
            darkModeIcon={ICONS.receiptIcon}
            lightsOutIcon={ICONS.receiptWhite}
          />
        </TouchableOpacity>
      </View>
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
          stickyHeaderIndices={[0]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={22}
          maxToRenderPerBatch={20}
          windowSize={3}
          contentContainerStyle={{
            paddingTop: 10,
            paddingBottom: bottomPadding,
          }}
        />
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    justifyContent: 'center',
  },
  topbarText: {
    width: SCREEN_DIMENSIONS.width * 0.95 - 140,
    flexShrink: 1,
    textAlign: 'center',
    fontSize: SIZES.xLarge,
    position: 'absolute',
  },
  countrySelectionContainer: {
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  itemSearch: {
    marginTop: 0,
    marginBottom: 10,
    paddingBottom: CONTENT_KEYBOARD_OFFSET,
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
