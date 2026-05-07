import {
  FlatList,
  Keyboard,
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
  VALID_URL_REGEX,
} from '../../../../../constants';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  WINDOWWIDTH,
} from '../../../../../constants/theme';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import sendStorePayment from '../../../../../functions/apps/payments';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
import { useKeysContext } from '../../../../../../context-store/keys';
import { CENTER, KEYBOARDTIMEOUT } from '../../../../../constants/styles';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import { useWebView } from '../../../../../../context-store/webViewContext';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../../../functions/CustomElements/button';
import LottieView from 'lottie-react-native';
import { updateConfirmAnimation } from '../../../../../functions/lottieViewColorTransformer';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { copyToClipboard } from '../../../../../functions';
import { useToast } from '../../../../../../context-store/toastManager';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
const confirmTxAnimation = require('../../../../../assets/confirmTxAnimation.json');

const imgEndpoint = endpoint => {
  if (VALID_URL_REGEX.test(endpoint)) {
    return endpoint;
  } else return `https://sms4sats.com/${endpoint}`;
};

export default function SMSMessagingReceivedPage(props) {
  const { sendWebViewRequest } = useWebView();
  const selectedCountry = props.route.params?.selectedCountry ?? {
    value: 999,
    label: 'Auto Select',
    iso: 'WW',
  };
  const [localSMSServicesList, setLocalSMSServicesList] = useState([]);
  const { publicKey, contactsPrivateKey } = useKeysContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation } = useSparkWallet();
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const { decodedMessages, toggleGlobalAppDataInformation } =
    useGlobalAppData();
  const { screenDimensions } = useAppStatus();
  const animationRef = useRef(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmResult, setConfirmResult] = useState({
    didSucceed: false,
    isRefund: false,
    number: null,
  });
  const { showToast } = useToast();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const navigate = useNavigation();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
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
    async function fetchLocationSpecificServices() {
      try {
        setIsLoadingLocationServices(true);
        const response = await fetch(
          `https://api2.sms4sats.com/getnumbersstatus?country=${selectedCountry.value}`,
          {
            method: 'GET',
          },
        );
        const data = await response.json();
        console.log(data);
        setLocalSMSServicesList(data);
      } catch (err) {
        console.log(err);
        navigate.navigate('ErrorScreen', {
          errorMessage: t('apps.sms4sats.receivePage.fetchServicesError', {
            defaultValue: 'Unable to load available SMS services',
          }),
        });
      } finally {
        setIsLoadingLocationServices(false);
      }
    }
    fetchLocationSpecificServices();
  }, [navigate, t, selectedCountry.value]);

  const handleItemSelector = useCallback(
    (serviceCode, title, imgSrc) => {
      setTimeout(
        () => {
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'confirmSMSReceive',
            serviceCode: serviceCode,
            location: selectedCountry.value,
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
    [navigate, handlePurchase, selectedCountry],
  );

  const keyboardFocusFunction = useCallback(() => {
    setIsKeyboardActive(true);
  }, []);

  const keyboardBlurFunction = useCallback(() => {
    setIsKeyboardActive(false);
  }, []);

  const confirmAnimation = useMemo(
    () =>
      updateConfirmAnimation(
        confirmTxAnimation,
        theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
      ),
    [theme, darkModeType],
  );

  useEffect(() => {
    if (isConfirmed) animationRef.current?.play();
  }, [isConfirmed]);

  const formatPhoneNumber = useCallback(num => {
    if (!num) return '';
    try {
      return parsePhoneNumberWithError('+' + num).formatInternational();
    } catch {
      return num;
    }
  }, []);

  const saveMessagesToDB = useCallback(
    messageObject => {
      const em = encriptMessage(
        contactsPrivateKey,
        publicKey,
        JSON.stringify(messageObject),
      );

      toggleGlobalAppDataInformation({ messagesApp: em }, true);
    },
    [contactsPrivateKey, publicKey],
  );

  const handlePurchase = useCallback(
    async invoiceInfo => {
      let savedMessages = null;
      try {
        setIsPurchasing(prev => ({ ...prev, isLoading: true }));
        savedMessages = JSON.parse(JSON.stringify(decodedMessages));

        const pendingOrder = {
          orderId: invoiceInfo.orderId,
          title: invoiceInfo.title,
          imgSrc: invoiceInfo.imgSrc,
          isPending: true,
          isRefunded: false,
          createdAt: Date.now(),
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
          sendWebViewRequest,
        });
        if (!paymentResponse.didWork)
          throw new Error(t('errormessages.paymentError'));

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
              setConfirmResult({
                didSucceed: true,
                isRefund: true,
                number: null,
              });
              setIsConfirmed(true);
            } else {
              setConfirmResult({
                didSucceed: false,
                isRefund: true,
                number: null,
              });
              setIsConfirmed(true);
            }
          } catch (err) {
            console.log('error canceling order', err);
            setConfirmResult({
              didSucceed: false,
              isRefund: true,
              number: null,
            });
            setIsConfirmed(true);
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

        setConfirmResult({
          didSucceed: true,
          isRefund: false,
          number: responseInfo.number,
        });
        setIsConfirmed(true);
      } catch (err) {
        console.log('error purchasing code', err);
        navigate.navigate('ErrorScreen', { errorMessage: err.message });
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

  const renderGridItem = useCallback(
    serviceItem => {
      return (
        <TouchableOpacity
          onPress={() =>
            handleItemSelector(
              serviceItem.value,
              serviceItem.text,
              serviceItem.image?.src,
            )
          }
          style={styles.gridItem}
        >
          <Image
            style={styles.gridAvatar}
            source={{ uri: imgEndpoint(serviceItem.image?.src) }}
            contentFit="contain"
          />
          <ThemeText
            content={serviceItem.text}
            styles={styles.gridServiceText}
            CustomNumberOfLines={2}
          />
        </TouchableOpacity>
      );
    },
    [handleItemSelector],
  );

  const renderItem = useCallback(
    ({ item }) => {
      if (!item) return null;

      return renderGridItem(item);
    },
    [renderGridItem],
  );

  const keyExtractor = useCallback((item, index) => {
    return `service-${item?.key}-${index}`;
  }, []);

  const memorizedKeyboardStyle = useMemo(() => {
    return {
      paddingBottom: isKeyboardActive ? CONTENT_KEYBOARD_OFFSET : 0,
    };
  }, [isKeyboardActive]);

  const handleBackPress = useCallback(() => {
    if (isConfirmed) {
      navigate.popTo('AppStorePageIndex', { page: 'sms4sats' });
      return true;
    } else return false;
  }, [isConfirmed]);

  useHandleBackPressNew(handleBackPress);

  if (isConfirmed) {
    return (
      <GlobalThemeView
        useStandardWidth={true}
        styles={styles.confirmedContainer}
      >
        <ScrollView
          contentContainerStyle={styles.confirmedScroll}
          showsVerticalScrollIndicator={false}
        >
          <LottieView
            ref={animationRef}
            source={confirmAnimation}
            loop={false}
            style={{
              width: screenDimensions.width / 1.5,
              height: screenDimensions.width / 1.5,
              maxWidth: 400,
              maxHeight: 400,
            }}
          />

          <ThemeText
            content={
              confirmResult.isRefund
                ? confirmResult.didSucceed
                  ? t('apps.sms4sats.confirmCodePage.automaticRefund')
                  : t('apps.sms4sats.confirmCodePage.waitedRefund')
                : t('apps.sms4sats.confirmCodePage.header')
            }
            styles={styles.confirmedTitle}
          />

          {!confirmResult.isRefund && (
            <>
              <TouchableOpacity
                onPress={() => copyToClipboard(confirmResult.number, showToast)}
                style={[
                  styles.phoneCard,
                  { backgroundColor: backgroundOffset },
                ]}
                activeOpacity={0.7}
              >
                <ThemeText
                  content={t('apps.sms4sats.confirmCodePage.phoneNumberLabel')}
                  styles={styles.phoneCardLabel}
                />
                <View style={styles.phoneCardRow}>
                  <ThemeText
                    CustomNumberOfLines={1}
                    adjustsFontSizeToFit={true}
                    content={formatPhoneNumber(confirmResult.number)}
                    styles={styles.phoneCardNumber}
                  />
                  <ThemeIcon iconName={'Copy'} size={18} />
                </View>
              </TouchableOpacity>

              <View
                style={[
                  styles.instructionBlock,
                  { backgroundColor: backgroundOffset },
                ]}
              >
                <View
                  style={[
                    styles.instructionIconWrap,
                    {
                      backgroundColor: theme ? backgroundColor : COLORS.primary,
                    },
                  ]}
                >
                  <ThemeIcon
                    iconName={'Info'}
                    size={15}
                    colorOverride={COLORS.darkModeText}
                  />
                </View>
                <View style={styles.instructionTexts}>
                  <ThemeText
                    styles={styles.instructionMain}
                    content={t('apps.sms4sats.confirmCodePage.step2')}
                  />
                  <ThemeText
                    styles={styles.instructionNote}
                    content={t('apps.sms4sats.confirmCodePage.step3')}
                  />
                </View>
              </View>
            </>
          )}
        </ScrollView>
        <CustomButton
          buttonStyles={{
            width: '100%',
          }}
          actionFunction={() =>
            navigate.popTo('AppStorePageIndex', { page: 'sms4sats' })
          }
          textContent={t('constants.continue')}
        />
      </GlobalThemeView>
    );
  }

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={true}
      globalThemeViewStyles={memorizedKeyboardStyle}
    >
      <CustomSettingsTopBar label={t('constants.receive')} />
      {isPurchasing.isLoading || isLoadingLocationServices ? (
        <FullLoadingScreen
          text={
            isLoadingLocationServices
              ? t('apps.sms4sats.receivePage.locationLoadingMessage')
              : isPurchasing.message
          }
        />
      ) : (
        <>
          <View style={styles.searchContainer}>
            <CustomSearchInput
              inputText={searchInput}
              setInputText={setSearchInput}
              containerStyles={{ ...styles.itemSearch, backgroundColor }}
              onFocusFunction={keyboardFocusFunction}
              onBlurFunction={keyboardBlurFunction}
              placeholderText={t('apps.sms4sats.receivePage.inputPlaceholder')}
            />
          </View>
          {filteredList.length === 0 ? (
            <ThemeText
              styles={styles.noItemsText}
              content={t('apps.sms4sats.receivePage.noAvailableServices')}
            />
          ) : (
            <FlatList
              data={filteredList}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              numColumns={3}
              showsVerticalScrollIndicator={false}
              initialNumToRender={21}
              maxToRenderPerBatch={21}
              windowSize={3}
              contentContainerStyle={{
                paddingTop: 10,
                paddingBottom: bottomPadding,
              }}
            />
          )}
        </>
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
    flexShrink: 1,
    textAlign: 'center',
    fontSize: SIZES.large,
    position: 'absolute',
  },
  countrySelectionContainer: {
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  searchContainer: {
    width: WINDOWWIDTH,
    marginBottom: 10,
    ...CENTER,
  },
  itemSearch: {
    marginTop: 0,
    marginBottom: 0,
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
    marginBottom: 15,
  },
  gridAvatar: {
    width: 70,
    height: 70,
    borderRadius: 12,
    marginBottom: 8,
  },
  gridServiceText: {
    fontSize: SIZES.small,
    textAlign: 'center',
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
  confirmedContainer: {
    flex: 1,
    alignItems: 'center',
    width: INSET_WINDOW_WIDTH,
  },
  confirmedScroll: {
    flexGrow: 1,
    alignItems: 'center',
  },
  confirmedTitle: {
    textAlign: 'center',
    fontSize: SIZES.large,
    includeFontPadding: false,
    marginBottom: 16,
  },
  phoneCard: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  phoneCardLabel: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
    marginBottom: 4,
  },
  phoneCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
  },
  phoneCardNumber: {
    fontSize: SIZES.xxLarge,
    includeFontPadding: false,
    flex: 1,
  },
  instructionBlock: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  instructionIconWrap: {
    padding: 9,
    borderRadius: 12,
  },
  instructionTexts: {
    flex: 1,
    gap: 8,
  },
  instructionMain: {
    includeFontPadding: false,
  },
  instructionNote: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
});
