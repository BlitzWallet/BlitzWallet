import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  EMAIL_REGEX,
  ICONS,
  SATSPERBITCOIN,
  SIZES,
} from '../../../../../constants';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../../../../functions';
import {useMemo, useState} from 'react';
import GetThemeColors from '../../../../../hooks/themeColors';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import {useNavigation} from '@react-navigation/native';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useGlobalContacts} from '../../../../../../context-store/globalContacts';
import {encriptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import {isMoreThanADayOld} from '../../../../../functions/rotateAddressDateChecker';
import {getFiatRates} from '../../../../../functions/SDK';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
// import {useNodeContext} from '../../../../../../context-store/nodeContext';
// import {useAppStatus} from '../../../../../../context-store/appStatus';
import {useKeysContext} from '../../../../../../context-store/keys';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import {keyboardGoBack} from '../../../../../functions/customNavigation';
import sendStorePayment from '../../../../../functions/apps/payments';
import {parse} from '@breeztech/react-native-breez-sdk-liquid';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';
import {useGlobalInsets} from '../../../../../../context-store/insetsProvider';

export default function ExpandedGiftCardPage(props) {
  const {sparkInformation} = useSparkWallet();
  const {contactsPrivateKey, publicKey} = useKeysContext();
  // const {nodeInformation, liquidNodeInformation} = useNodeContext();
  // const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {globalContactsInformation} = useGlobalContacts();
  const {masterInfoObject} = useGlobalContextProvider();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const {decodedGiftCards, toggleGlobalAppDataInformation} = useGlobalAppData();
  const [numberOfGiftCards, setNumberOfGiftCards] = useState('1');
  const selectedItem = props.route?.params?.selectedItem;
  const [selectedDenomination, setSelectedDenomination] = useState(
    selectedItem.denominationType === 'Variable'
      ? ''
      : selectedItem.denominations[0],
  );
  const navigate = useNavigation();
  useHandleBackPressNew();

  const [isPurchasingGift, setIsPurchasingGift] = useState({
    isPurasing: false,
    hasError: false,
    errorMessage: '',
  });
  const [email, setEmail] = useState(decodedGiftCards?.profile?.email || '');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const {bottomPadding} = useGlobalInsets();

  const variableRange = [
    selectedItem.denominations[0],
    selectedItem.denominations[selectedItem.denominations.length - 1],
  ];
  const step = Math.round((variableRange[1] - variableRange[0]) / 7); // Divide the range into 8 pieces, so 7 intervals

  const veriableArray = useMemo(() => {
    return Array.from({length: 8}, (_, i) => {
      const floorAmount = Math.floor((variableRange[0] + step * i) / 50) * 50;
      const amount = variableRange[0] + step * i;

      if (i === 0) return variableRange[0];
      else if (i === 7) return variableRange[1];
      else {
        if (amount < 50) return Math.floor(amount / 5) * 5;
        else if (amount > 50 && amount < 150)
          return Math.floor(amount / 10) * 10;
        else return floorAmount;
      }
    });
  }, [variableRange, step]);

  const demoninationArray =
    selectedItem.denominationType === 'Variable'
      ? veriableArray
      : selectedItem.denominations;

  const demonimationElements = useMemo(() => {
    return demoninationArray.map((item, index) => {
      return (
        <TouchableOpacity
          onPress={() => setSelectedDenomination(item)}
          key={item}
          style={{
            flexGrow: 1,
            minWidth: 100,
            paddingVertical: 10,
            paddingHorizontal: 10,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              theme && darkModeType
                ? selectedDenomination == item
                  ? COLORS.lightsOutBackground
                  : COLORS.white
                : selectedDenomination == item
                ? theme
                  ? COLORS.darkModeBackground
                  : COLORS.primary
                : theme
                ? COLORS.darkModeText
                : COLORS.lightBlueForGiftCards,
          }}>
          <ThemeText
            styles={{
              color:
                theme && darkModeType
                  ? selectedDenomination == item
                    ? COLORS.darkModeText
                    : COLORS.lightModeText
                  : selectedDenomination == item
                  ? theme
                    ? COLORS.darkModeText
                    : COLORS.white
                  : theme
                  ? COLORS.lightModeText
                  : COLORS.white,

              fontSize: SIZES.small,
              includeFontPadding: false,
              textAlign: 'center',
            }}
            content={`${item} ${selectedItem.currency}`}
          />
        </TouchableOpacity>
      );
    });
  }, [demoninationArray, theme, darkModeType, selectedDenomination]);

  const canPurchaseCard =
    selectedDenomination >= variableRange[0] &&
    selectedDenomination <= variableRange[1];

  const isDescriptionHTML =
    selectedItem.description.includes('<p>') ||
    selectedItem.description.includes('br');
  const isTermsHTML =
    selectedItem.terms.includes('<p>') || selectedItem.terms.includes('br');

  return (
    <CustomKeyboardAvoidingView useStandardWidth={true}>
      <View style={{flex: 1}}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => {
              keyboardGoBack(navigate);
            }}
            style={{marginRight: 'auto'}}>
            <ThemeImage
              lightModeIcon={ICONS.smallArrowLeft}
              darkModeIcon={ICONS.smallArrowLeft}
              lightsOutIcon={ICONS.arrow_small_left_white}
            />
          </TouchableOpacity>
        </View>
        {isPurchasingGift.isPurasing ? (
          <FullLoadingScreen
            showLoadingIcon={isPurchasingGift.hasError ? false : true}
            textStyles={{textAlign: 'center'}}
            text={
              isPurchasingGift.hasError
                ? isPurchasingGift.errorMessage
                : 'Purchasing gift card, do not leave the page.'
            }
          />
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingBottom: isKeyboardActive
                ? CONTENT_KEYBOARD_OFFSET
                : bottomPadding,
            }}
            showsVerticalScrollIndicator={false}>
            <View style={styles.contentContainer}>
              <Image
                style={styles.companyLogo}
                source={{uri: selectedItem.logo}}
              />
              <View style={{flex: 1}}>
                <ThemeText
                  styles={styles.companyName}
                  content={selectedItem.name}
                />
              </View>
            </View>
            <ThemeText
              styles={{marginBottom: 15}}
              content={'Select an amount'}
            />
            <View
              style={{
                padding: 20,
                backgroundColor: backgroundOffset,
                borderRadius: 10,
              }}>
              {selectedItem.denominationType === 'Variable' && (
                <>
                  <CustomSearchInput
                    inputText={String(selectedDenomination)}
                    setInputText={setSelectedDenomination}
                    placeholderText={`${selectedItem.denominations[0]} ${selectedItem.currency} - ${selectedItem.denominations[1]} ${selectedItem.currency}`}
                    keyboardType={'number-pad'}
                    textInputStyles={{
                      backgroundColor: COLORS.darkModeText,
                      borderWidth: 1,
                      borderColor:
                        !canPurchaseCard && selectedDenomination
                          ? theme && darkModeType
                            ? backgroundColor
                            : COLORS.cancelRed
                          : backgroundOffset,
                      color: COLORS.lightModeText,
                    }}
                    containerStyles={{marginBottom: 10}}
                    placeholderTextColor={COLORS.opaicityGray}
                    onBlurFunction={() => setIsKeyboardActive(false)}
                    onFocusFunction={() => setIsKeyboardActive(true)}
                  />
                  {!canPurchaseCard && !!selectedDenomination && (
                    <ThemeText
                      styles={{
                        color:
                          theme && darkModeType
                            ? COLORS.white
                            : COLORS.cancelRed,
                        marginBottom: 10,
                        textAlign: 'center',
                      }}
                      content={`You can buy a ${
                        selectedDenomination <= variableRange[0] ? 'min' : 'max'
                      } amount of ${
                        selectedDenomination <= variableRange[0]
                          ? variableRange[0]
                          : variableRange[1]
                      } ${selectedItem.currency}`}
                    />
                  )}
                </>
              )}

              <View style={styles.amountContainer}>{demonimationElements}</View>

              <ThemeText
                styles={{marginTop: 20, marginBottom: 5}}
                content={'Sending to:'}
              />
              <CustomSearchInput
                inputText={email}
                setInputText={setEmail}
                placeholderText={'Enter Email'}
                textInputStyles={{
                  marginBottom: 0,
                  backgroundColor: COLORS.darkModeText,
                  borderWidth: 1,
                  borderColor: !EMAIL_REGEX.test(email)
                    ? theme && darkModeType
                      ? backgroundColor
                      : COLORS.cancelRed
                    : backgroundOffset,
                  color: COLORS.lightModeText,
                }}
                placeholderTextColor={COLORS.opaicityGray}
                onBlurFunction={() => setIsKeyboardActive(false)}
                onFocusFunction={() => setIsKeyboardActive(true)}
              />
            </View>

            <CustomButton
              buttonStyles={{
                ...styles.purchaseButton,
                backgroundColor:
                  theme && darkModeType
                    ? COLORS.lightsOutBackgroundOffset
                    : COLORS.primary,
                opacity:
                  canPurchaseCard &&
                  numberOfGiftCards >= 1 &&
                  EMAIL_REGEX.test(email)
                    ? 1
                    : 0.4,
              }}
              textStyles={{
                color: COLORS.darkModeText,
              }}
              textContent={'Purchase gift card'}
              actionFunction={() => {
                if (
                  !canPurchaseCard ||
                  numberOfGiftCards < 1 ||
                  !EMAIL_REGEX.test(email)
                )
                  return;

                if (email != decodedGiftCards?.profile?.email) {
                  navigate.navigate('ConfirmActionPage', {
                    confirmMessage:
                      'The current email is different than the saved one. Would you like to make this email your primary?',
                    confirmFunction: () => saveNewEmail(true),
                    cancelFunction: () => saveNewEmail(false),
                  });
                  return;
                }

                navigate.navigate('CustomHalfModal', {
                  wantedContent: 'giftCardConfirm',
                  quantity: numberOfGiftCards,
                  price: selectedDenomination,
                  productId: selectedItem.id,
                  purchaseGiftCard: purchaseGiftCard,
                  email: email,
                  blitzUsername:
                    globalContactsInformation.myProfile.name ||
                    globalContactsInformation.myProfile.uniqueName,
                  sliderHight: 0.5,
                });
              }}
            />
            <ThemeText
              styles={{
                fontSize: SIZES.large,
                fontWeight: 500,
                marginBottom: 20,
                textAlign: 'center',
              }}
              content={'Terms'}
            />

            {selectedItem.description && (
              <>
                {isDescriptionHTML ? (
                  <CustomButton
                    buttonStyles={{
                      width: 'auto',
                      ...CENTER,
                    }}
                    textContent={'Card Description'}
                    actionFunction={() => {
                      navigate.navigate('CustomWebView', {
                        headerText: 'Card Description',
                        webViewURL: selectedItem.description,
                        isHTML: true,
                      });
                    }}
                  />
                ) : (
                  <ThemeText content={selectedItem.description} />
                )}
              </>
            )}
            <View style={{height: 40}}></View>

            {isTermsHTML ? (
              <CustomButton
                buttonStyles={{
                  width: 'auto',
                  ...CENTER,
                }}
                textContent={'Card terms'}
                actionFunction={() => {
                  navigate.navigate('CustomWebView', {
                    headerText: 'Card Terms',
                    webViewURL: selectedItem.terms,
                    isHTML: true,
                  });
                }}
              />
            ) : (
              <ThemeText content={selectedItem.terms} />
            )}
          </ScrollView>
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );

  function saveNewEmail(wantsToSave) {
    if (wantsToSave) {
      const em = encriptMessage(
        contactsPrivateKey,
        publicKey,
        JSON.stringify({
          ...decodedGiftCards,
          profile: {
            ...decodedGiftCards.profile,
            email: email,
          },
        }),
      );
      toggleGlobalAppDataInformation({giftCards: em}, true);
    } else {
      setEmail(decodedGiftCards?.profile?.email || '');
    }
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'giftCardConfirm',
      quantity: numberOfGiftCards,
      price: selectedDenomination,
      productId: selectedItem.id,
      purchaseGiftCard: purchaseGiftCard,
      email: email,
      blitzUsername:
        globalContactsInformation.myProfile.name ||
        globalContactsInformation.myProfile.uniqueName,
      sliderHight: 0.5,
    });
  }

  async function purchaseGiftCard(responseObject) {
    console.log(responseObject);

    try {
      setIsPurchasingGift(prev => {
        return {...prev, isPurasing: true};
      });
      const responseInvoice = responseObject.invoice;

      const [parsedInput, fiatRates, dailyPurchaseAmount] = await Promise.all([
        parse(responseInvoice),
        getFiatRates(),
        getLocalStorageItem('dailyPurchaeAmount').then(JSON.parse),
      ]);

      const USDBTCValue = fiatRates.find(currency => currency.coin === 'USD');
      const sendingAmountSat = parsedInput.invoice.amountMsat / 1000;
      const currentTime = new Date();

      if (dailyPurchaseAmount) {
        if (isMoreThanADayOld(dailyPurchaseAmount.date)) {
          setLocalStorageItem(
            'dailyPurchaeAmount',
            JSON.stringify({date: currentTime, amount: sendingAmountSat}),
          );
        } else {
          const totalPurchaseAmount = Math.round(
            ((dailyPurchaseAmount.amount + sendingAmountSat) / SATSPERBITCOIN) *
              USDBTCValue.value,
          );

          if (totalPurchaseAmount > 9000) {
            setIsPurchasingGift(prev => {
              return {
                hasError: false,
                errorMessage: '',
                isPurasing: false,
              };
            });
            navigate.navigate('ErrorScreen', {
              errorMessage: 'You have hit your daily purchase limit',
            });
            return;
          }
          setLocalStorageItem(
            'dailyPurchaeAmount',
            JSON.stringify({
              date: dailyPurchaseAmount.date,
              amount: dailyPurchaseAmount.amount + sendingAmountSat,
            }),
          );
        }
      } else {
        setLocalStorageItem(
          'dailyPurchaeAmount',
          JSON.stringify({
            date: currentTime,
            amount: sendingAmountSat,
          }),
        );
      }

      const paymentResponse = await sendStorePayment({
        invoice: responseInvoice,
        masterInfoObject: masterInfoObject,
        sendingAmountSats: sendingAmountSat,
        fee: responseObject?.supportFee + responseObject?.paymentFee,
        userBalance: sparkInformation.balance,
        sparkInformation: sparkInformation,
      });

      if (!paymentResponse.didWork) {
        setIsPurchasingGift(prev => {
          return {
            ...prev,
            isPurasing: false,
            hasError: false,
            errorMessage: '',
          };
        });
        navigate.navigate('ErrorScreen', {
          errorMessage: paymentResponse.reason || 'Error paying invoice.',
        });
        return;
      }

      saveClaimInformation({
        responseObject,
        paymentObject: paymentResponse.response,
      });
      return;
    } catch (err) {
      setIsPurchasingGift(prev => {
        return {
          ...prev,
          hasError: true,
          errorMessage:
            'Not able to get gift cards invoice, are you sure you are connected to the internet?',
        };
      });

      console.log(err);
    }
  }

  async function saveClaimInformation({
    responseObject,
    paymentObject,
    nodeType,
    currentTime,
  }) {
    const newClaimInfo = {
      logo: selectedItem.logo,
      name: selectedItem.name,
      id: responseObject.orderId,
      uuid: responseObject.uuid,
      invoice: responseObject.invoice,
      date: currentTime,
    };
    const newCardsList = decodedGiftCards?.purchasedCards
      ? [...decodedGiftCards.purchasedCards, newClaimInfo]
      : [newClaimInfo];

    const em = encriptMessage(
      contactsPrivateKey,
      publicKey,
      JSON.stringify({
        ...decodedGiftCards,
        purchasedCards: newCardsList,
      }),
    );
    toggleGlobalAppDataInformation({giftCards: em}, true);
    navigate.reset({
      index: 0,
      routes: [
        {
          name: 'HomeAdmin',
          params: {screen: 'Home'},
        },
        {
          name: 'ConfirmTxPage',
          params: {
            for: 'paymentSucceed',
            transaction: paymentObject,
          },
        },
      ],
    });
  }
}
const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    ...CENTER,
  },

  purchaseButton: {
    width: 'auto',
    ...CENTER,
    marginBottom: 40,
    marginTop: 50,
  },

  contentContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 30,
  },
  companyLogo: {
    width: 80,
    height: 80,
    marginRight: 20,
    borderRadius: 15,
    resizeMode: 'contain',
  },
  companyName: {
    fontWeight: '500',
    fontSize: SIZES.xLarge,
  },
  amountContainer: {
    flexDirection: 'row',
    columnGap: 10,
    rowGap: 10,
    flexWrap: 'wrap',
  },
});
