import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  EMAIL_REGEX,
  SIZES,
} from '../../../../../constants';
import { useCallback, useMemo, useState } from 'react';
import GetThemeColors from '../../../../../hooks/themeColors';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import { useNavigation } from '@react-navigation/native';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useGlobalContextProvider } from '../../../../../../context-store/context';

import { keyboardGoBack } from '../../../../../functions/customNavigation';
import sendStorePayment from '../../../../../functions/apps/payments';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import loadNewFiatData from '../../../../../functions/saveAndUpdateFiatData';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { Image } from 'expo-image';
import giftCardPurchaseAmountTracker from '../../../../../functions/apps/giftCardPurchaseTracker';
import { useWebView } from '../../../../../../context-store/webViewContext';

export default function ExpandedGiftCardPage(props) {
  const { sendWebViewRequest } = useWebView();
  const { sparkInformation } = useSparkWallet();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { globalContactsInformation } = useGlobalContacts();
  const { masterInfoObject } = useGlobalContextProvider();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { fiatStats } = useNodeContext();
  const { decodedGiftCards, toggleGlobalAppDataInformation } =
    useGlobalAppData();
  const [numberOfGiftCards, setNumberOfGiftCards] = useState('1');
  const fromSelectGiftPage = props.route?.params?.fromSelectGiftPage;
  const selectedItem = props.route?.params?.selectedItem;
  const [giftMessageForContacts, setGiftMessageForContacts] = useState('');
  const isVariable =
    selectedItem.denominationType === 'Variable' &&
    selectedItem.denominations?.length >= 2;
  const [selectedDenomination, setSelectedDenomination] = useState(
    isVariable ? '' : selectedItem.denominations[0],
  );
  const { t } = useTranslation();
  const navigate = useNavigation();

  const [isPurchasingGift, setIsPurchasingGift] = useState({
    isPurasing: false,
    hasError: false,
    errorMessage: '',
  });
  const [email, setEmail] = useState(decodedGiftCards?.profile?.email || '');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const { bottomPadding } = useGlobalInsets();

  const variableRange = [
    selectedItem.denominations?.[0],
    selectedItem.denominations?.[selectedItem.denominations.length - 1],
  ];
  const step = Math.round((variableRange[1] - variableRange[0]) / 7);

  const veriableArray = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
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

  const demoninationArray = isVariable
    ? veriableArray
    : selectedItem.denominations;

  const demonimationElements = useMemo(() => {
    return demoninationArray.map((item, index) => {
      const isSelected = selectedDenomination == item;

      return (
        <TouchableOpacity
          onPress={() => setSelectedDenomination(item)}
          key={item}
          style={[
            styles.denominationChip,
            {
              backgroundColor: isSelected
                ? theme && darkModeType
                  ? COLORS.darkModeText
                  : COLORS.primary
                : theme
                ? backgroundColor
                : COLORS.white,
            },
          ]}
        >
          <ThemeText
            styles={{
              ...styles.denominationText,
              color: isSelected
                ? theme && darkModeType
                  ? COLORS.lightModeText
                  : COLORS.darkModeText
                : theme
                ? COLORS.darkModeText
                : COLORS.lightModeText,
              fontWeight: isSelected ? '500' : '400',
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

  const isTermsHTML =
    selectedItem?.terms?.includes('<p>') || selectedItem?.terms?.includes('br');

  const customBack = useCallback(() => {
    keyboardGoBack(navigate);
  }, [navigate]);

  const isFormValid =
    canPurchaseCard &&
    numberOfGiftCards >= 1 &&
    (fromSelectGiftPage || EMAIL_REGEX.test(email));

  return (
    <CustomKeyboardAvoidingView
      globalThemeViewStyles={{
        paddingBottom: isKeyboardActive ? CONTENT_KEYBOARD_OFFSET : 0,
      }}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        containerStyles={styles.topBar}
        customBackFunction={customBack}
      />
      {isPurchasingGift.isPurasing ? (
        <FullLoadingScreen
          showLoadingIcon={isPurchasingGift.hasError ? false : true}
          textStyles={styles.loadingScreenText}
          text={
            isPurchasingGift.hasError
              ? isPurchasingGift.errorMessage
              : t('apps.giftCards.expandedGiftCardPage.purchasingCardMessage')
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: bottomPadding,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Image
                style={styles.companyLogo}
                source={{ uri: selectedItem.logo }}
                contentFit="contain"
              />
            </View>
            <ThemeText
              styles={styles.companyName}
              content={selectedItem.name}
            />
          </View>

          {/* Amount Selection Section */}
          <View style={styles.sectionContainer}>
            <ThemeText
              styles={styles.sectionTitle}
              content={t('apps.giftCards.expandedGiftCardPage.selectamount')}
            />

            <View
              style={[
                styles.cardContainer,
                { backgroundColor: backgroundOffset },
              ]}
            >
              {selectedItem.denominationType === 'Variable' && (
                <View style={styles.customAmountSection}>
                  <CustomSearchInput
                    inputText={String(selectedDenomination)}
                    setInputText={setSelectedDenomination}
                    placeholderText={`${selectedItem.denominations[0]} ${selectedItem.currency} - ${selectedItem.denominations[1]} ${selectedItem.currency}`}
                    keyboardType={'number-pad'}
                    textInputStyles={{
                      ...styles.customAmountInput,
                      backgroundColor: theme ? backgroundColor : COLORS.white,
                      borderColor:
                        !canPurchaseCard && selectedDenomination
                          ? theme && darkModeType
                            ? COLORS.darkModeText
                            : COLORS.cancelRed
                          : 'transparent',
                      color: theme ? COLORS.darkModeText : COLORS.lightModeText,
                    }}
                    containerStyles={styles.customAmountContainer}
                    placeholderTextColor={COLORS.opaicityGray}
                    onBlurFunction={() => setIsKeyboardActive(false)}
                    onFocusFunction={() => setIsKeyboardActive(true)}
                  />
                  {!canPurchaseCard && !!selectedDenomination && (
                    <View style={styles.errorContainer}>
                      <ThemeText
                        styles={{
                          ...styles.errorText,
                          color:
                            !canPurchaseCard && selectedDenomination
                              ? theme && darkModeType
                                ? COLORS.darkModeText
                                : COLORS.cancelRed
                              : 'transparent',
                        }}
                        content={t(
                          'apps.giftCards.expandedGiftCardPage.minMaxPurchaseAmount',
                          {
                            min:
                              selectedDenomination <= variableRange[0]
                                ? 'min'
                                : 'max',
                            max:
                              selectedDenomination <= variableRange[0]
                                ? variableRange[0]
                                : variableRange[1],
                            currency: selectedItem.currency,
                          },
                        )}
                      />
                    </View>
                  )}
                </View>
              )}

              <View style={styles.denominationGrid}>
                {demonimationElements}
              </View>
            </View>
          </View>

          {/* Memo for gift Section */}
          {fromSelectGiftPage && (
            <View style={styles.sectionContainer}>
              <ThemeText
                styles={styles.sectionTitle}
                content={t('apps.giftCards.expandedGiftCardPage.giftMessage')}
              />
              <View
                style={[
                  styles.cardContainer,
                  { backgroundColor: backgroundOffset },
                ]}
              >
                <CustomSearchInput
                  inputText={giftMessageForContacts}
                  setInputText={setGiftMessageForContacts}
                  placeholderText={t(
                    'apps.giftCards.expandedGiftCardPage.giftMessagePlaceholder',
                  )}
                  maxLength={150}
                  textInputStyles={{
                    ...styles.emailInput,
                    backgroundColor: theme ? backgroundColor : COLORS.white,
                    color: theme ? COLORS.darkModeText : COLORS.lightModeText,
                    borderWidth: 0,
                  }}
                  placeholderTextColor={COLORS.opaicityGray}
                  onBlurFunction={() => setIsKeyboardActive(false)}
                  onFocusFunction={() => setIsKeyboardActive(true)}
                />
              </View>
            </View>
          )}

          {/* Email Section */}
          {!fromSelectGiftPage && (
            <View style={styles.sectionContainer}>
              <ThemeText
                styles={styles.sectionTitle}
                content={t('apps.giftCards.expandedGiftCardPage.sendingto')}
              />
              <View
                style={[
                  styles.cardContainer,
                  { backgroundColor: backgroundOffset },
                ]}
              >
                <CustomSearchInput
                  inputText={email}
                  setInputText={setEmail}
                  placeholderText={t(
                    'apps.giftCards.expandedGiftCardPage.emailPlaceholder',
                  )}
                  textInputStyles={{
                    ...styles.emailInput,
                    backgroundColor: theme ? backgroundColor : COLORS.white,
                    borderColor:
                      !EMAIL_REGEX.test(email) && email !== ''
                        ? theme && darkModeType
                          ? COLORS.darkModeText
                          : COLORS.cancelRed
                        : 'transparent',
                    color: theme ? COLORS.darkModeText : COLORS.lightModeText,
                  }}
                  placeholderTextColor={COLORS.opaicityGray}
                  onBlurFunction={() => setIsKeyboardActive(false)}
                  onFocusFunction={() => setIsKeyboardActive(true)}
                />
              </View>
            </View>
          )}

          {/* Purchase Button */}
          <View style={styles.purchaseSection}>
            <CustomButton
              buttonStyles={styles.purchaseButton}
              textStyles={styles.purchaseButtonText}
              textContent={t(
                `apps.giftCards.expandedGiftCardPage.${
                  fromSelectGiftPage ? 'selectForContactBTN' : 'purchaseBTN'
                }`,
              )}
              actionFunction={() => {
                if (!canPurchaseCard) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage: t(
                      'apps.giftCards.expandedGiftCardPage.noAmountError',
                    ),
                  });
                  return;
                }
                if (fromSelectGiftPage) {
                  navigate.popTo(
                    'SendAndRequestPage',
                    {
                      cardInfo: {
                        ...props.route.params?.cardInfo,
                        selectedDenomination: selectedDenomination,
                        memo: giftMessageForContacts,
                      },
                    },
                    { merge: true },
                  );
                  return;
                }
                if (!email) return;
                if (email != decodedGiftCards?.profile?.email) {
                  navigate.navigate('ConfirmActionPage', {
                    confirmMessage: t(
                      'apps.giftCards.expandedGiftCardPage.differentEmailMessage',
                    ),
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
          </View>

          {/* Terms and Description Section */}
          {selectedItem.terms && (
            <View>
              <ThemeText
                styles={styles.infoSectionTitle}
                content={t('apps.giftCards.expandedGiftCardPage.terms')}
              />
              <View style={styles.infoItem}>
                {isTermsHTML ? (
                  <CustomButton
                    buttonStyles={{
                      ...styles.infoButton,
                      borderColor:
                        theme && darkModeType
                          ? COLORS.darkModeText
                          : COLORS.primary + '30',
                    }}
                    textStyles={{
                      ...styles.infoButtonText,
                      color:
                        theme && darkModeType
                          ? COLORS.darkModeText
                          : COLORS.primary,
                    }}
                    textContent={t(
                      'apps.giftCards.expandedGiftCardPage.cardTerms',
                    )}
                    actionFunction={() => {
                      navigate.navigate('CustomWebView', {
                        headerText: t(
                          'apps.giftCards.expandedGiftCardPage.cardTerms',
                        ),
                        webViewURL: selectedItem.terms,
                        isHTML: true,
                      });
                    }}
                  />
                ) : (
                  <View
                    style={[
                      styles.infoTextContainer,
                      { backgroundColor: backgroundOffset },
                    ]}
                  >
                    <ThemeText
                      styles={styles.infoText}
                      content={selectedItem.terms}
                    />
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      )}
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
      toggleGlobalAppDataInformation({ giftCards: em }, true);
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
        return { ...prev, isPurasing: true };
      });
      const responseInvoice = responseObject.invoice;

      const fiatRates = await (fiatStats.coin?.toLowerCase()
        ? Promise.resolve({ didWork: true, fiatRateResponse: fiatStats })
        : loadNewFiatData(
            'usd',
            contactsPrivateKey,
            publicKey,
            masterInfoObject,
          ));

      const USDBTCValue = fiatRates.didWork
        ? fiatRates.fiatRateResponse
        : { coin: 'USD', value: 100_000 };
      const sendingAmountSat = responseObject.amountSat;
      const memo = responseObject.description;
      const currentTime = new Date();

      const isOverDailyLimit = await giftCardPurchaseAmountTracker({
        sendingAmountSat: sendingAmountSat,
        USDBTCValue: USDBTCValue,
      });

      if (isOverDailyLimit.shouldBlock) {
        navigate.navigate('ErrorScreen', {
          errorMessage: isOverDailyLimit.reason,
        });
        return;
      }

      const paymentResponse = await sendStorePayment({
        invoice: responseInvoice,
        masterInfoObject: masterInfoObject,
        sendingAmountSats: sendingAmountSat,
        fee: responseObject?.supportFee + responseObject?.paymentFee,
        userBalance: sparkInformation.balance,
        sparkInformation: sparkInformation,
        description: memo,
        currentWalletMnemoinc: currentWalletMnemoinc,
        sendWebViewRequest,
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
          errorMessage: t('errormessages.paymentError'),
        });
        return;
      }

      saveClaimInformation({
        responseObject,
        paymentObject: {
          ...paymentResponse.response,
          date: currentTime,
        },
        currentTime: currentTime,
      });
      return;
    } catch (err) {
      setIsPurchasingGift(prev => {
        return {
          ...prev,
          hasError: true,
          errorMessage: t('errormessages.invoiceRetrivalError'),
        };
      });
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
    toggleGlobalAppDataInformation({ giftCards: em }, true);
    navigate.reset({
      index: 0,
      routes: [
        {
          name: 'HomeAdmin',
          params: { screen: 'Home' },
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
    marginBottom: 0,
  },
  loadingScreenText: {
    textAlign: 'center',
    width: INSET_WINDOW_WIDTH,
  },

  // Header Section
  headerSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 40,
  },
  logoContainer: {
    width: 100,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.darkModeText,
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
  },
  companyLogo: {
    width: '100%',
    height: '100%',
    maxWidth: 80,
    maxHeight: 80,
    borderRadius: 12,
  },
  companyName: {
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    lineHeight: SIZES.xLarge * 1.2,
  },

  // Section Container
  sectionContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 12,
    opacity: 0.8,
  },
  cardContainer: {
    borderRadius: 16,
    padding: 20,
  },

  // Custom Amount Section
  customAmountSection: {
    marginBottom: 20,
  },
  customAmountContainer: {
    marginBottom: 0,
  },
  customAmountInput: {
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: SIZES.medium,
  },
  errorContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: SIZES.small,
    color: COLORS.cancelRed,
    textAlign: 'center',
  },

  // Denomination Grid
  denominationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  denominationChip: {
    flexGrow: 1,
    minWidth: '45%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  denominationText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    textAlign: 'center',
  },

  // Email Section
  emailInput: {
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: SIZES.medium,
  },

  // Purchase Section
  purchaseSection: {
    marginBottom: 48,
  },
  purchaseButton: {
    minWidth: '70%',
    alignSelf: 'center',
  },
  purchaseButtonText: {
    textAlign: 'center',
  },

  // Info Section
  infoSection: {},
  infoSectionTitle: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.9,
  },
  infoItem: {
    marginBottom: 16,
  },
  infoButton: {
    minWidth: '70%',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    backgroundColor: 'transparent',
    ...CENTER,
  },
  infoButtonText: {
    fontSize: SIZES.medium,
  },
  infoTextContainer: {
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: SIZES.small,
    lineHeight: SIZES.small * 1.5,
    opacity: 0.8,
  },
});
