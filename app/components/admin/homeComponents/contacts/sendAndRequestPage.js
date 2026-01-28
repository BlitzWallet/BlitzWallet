import { StyleSheet, ScrollView, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  HIDE_IN_APP_PURCHASE_ITEMS,
  ICONS,
  QUICK_PAY_STORAGE_KEY,
  SATSPERBITCOIN,
  USDB_TOKEN_ID,
} from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { publishMessage } from '../../../../functions/messaging/publishMessage';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import customUUID from '../../../../functions/customUUID';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { useKeysContext } from '../../../../../context-store/keys';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import { useServerTimeOnly } from '../../../../../context-store/serverTime';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import GetThemeColors from '../../../../hooks/themeColors';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
  WINDOWWIDTH,
} from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import fetchBackend from '../../../../../db/handleBackend';
import { getDataFromCollection } from '../../../../../db';
import { Image } from 'expo-image';
import loadNewFiatData from '../../../../functions/saveAndUpdateFiatData';
import giftCardPurchaseAmountTracker from '../../../../functions/apps/giftCardPurchaseTracker';
import DropdownMenu from '../../../../functions/CustomElements/dropdownMenu';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import getReceiveAddressAndContactForContactsPayment from './internalComponents/getReceiveAddressAndKindForPayment';
import calculateProgressiveBracketFee from '../../../../functions/spark/calculateSupportFee';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import NavBarWithBalance from '../../../../functions/CustomElements/navWithBalance';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import { receiveSparkLightningPayment } from '../../../../functions/spark';
import { getBolt11InvoiceForContact } from '../../../../functions/contacts';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import EmojiQuickBar from '../../../../functions/CustomElements/emojiBar';
import usePaymentMethodSelection from '../../../../hooks/usePaymentMethodSelection';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import {
  dollarsToSats,
  satsToDollars,
} from '../../../../functions/spark/flashnet';
import ChoosePaymentMethod from '../sendBitcoin/components/choosePaymentMethodContainer';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import usePaymentValidation from '../sendBitcoin/functions/paymentValidation';
import { InputTypes } from 'bitcoin-address-parser';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
const MAX_SEND_OPTIONS = [
  { label: '25%', value: '25' },
  { label: '50%', value: '50' },
  { label: '75%', value: '75' },
  { label: '100%', value: '100' },
];

export default function SendAndRequestPage(props) {
  const {
    selectedRequestMethod = 'BTC',
    selectedPaymentMethod = 'BTC',
    endReceiveType = 'BTC',
    selectedContact,
    paymentType, // 'send' or 'request'
    imageData,
    cardInfo: giftOption,
  } = props.route.params || {};

  const navigate = useNavigation();
  const { dollarBalanceSat, dollarBalanceToken, bitcoinBalance } =
    useUserBalanceContext();
  const { poolInfoRef, swapLimits, swapUSDPriceDollars } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation } = useSparkWallet();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { isConnectedToTheInternet } = useAppStatus();
  const { fiatStats } = useNodeContext();
  const { globalContactsInformation } = useGlobalContacts();
  const getServerTime = useServerTimeOnly();
  const [amountValue, setAmountValue] = useState('');
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(
    giftOption?.memo || '',
  );
  const [isLoading, setIsLoading] = useState(false);
  const { bottomPadding } = useGlobalInsets();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const poolInfoRefSnapshotRef = useRef(poolInfoRef);

  const descriptionRef = useRef(null);

  useEffect(() => {
    if (typeof giftOption?.memo !== 'string') return;
    setDescriptionValue(giftOption.memo);
  }, [giftOption?.memo]);

  const paymentMode =
    paymentType === 'send' || paymentType === 'Gift'
      ? selectedPaymentMethod
      : selectedRequestMethod;

  // Determine if we're in USD mode
  const isUSDMode =
    paymentType === 'send' || paymentType === 'Gift'
      ? selectedPaymentMethod === 'USD'
      : selectedRequestMethod === 'USD';

  const [inputDenomination, setInputDenomination] = useState(
    paymentMode === 'USD'
      ? 'fiat'
      : masterInfoObject.userBalanceDenomination !== 'fiat'
      ? 'sats'
      : 'fiat',
  );

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    convertSatsToDisplay,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode,
    inputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
  });

  const displayAmount =
    paymentType !== 'Gift' ? amountValue : convertSatsToDisplay(amountValue);

  // Calculate sat amount
  const convertedSendAmount =
    paymentType === 'Gift'
      ? Number(amountValue)
      : convertDisplayToSats(amountValue);

  const min_usd_swap_amount = useMemo(() => {
    return Math.round(
      dollarsToSats(
        swapLimits.usd,
        poolInfoRefSnapshotRef.current.currentPriceAInB,
      ),
    );
  }, [poolInfoRefSnapshotRef.current.currentPriceAInB, swapLimits]);

  const paymentValidation = usePaymentValidation({
    paymentInfo: {
      sendAmount: convertedSendAmount,
      paymentNetwork:
        giftOption || selectedContact?.isLNURL ? 'lightning' : 'spark',
      isLNURLPayment: selectedContact?.isLNURL,
      data: {
        expectedReceive: endReceiveType === 'BTC' ? 'sats' : 'tokens',
        expectedToken: endReceiveType === 'BTC' ? null : USDB_TOKEN_ID,
      },
      decodedInput: {
        tpye:
          giftOption || selectedContact?.isLNURL ? InputTypes.BOLT11 : 'spark',
        data: { amountMsat: convertedSendAmount * 1000 },
      },
    },
    convertedSendAmount,
    paymentFee: 0, //need to calculate swap fee,
    determinePaymentMethod: selectedPaymentMethod,
    selectedPaymentMethod,

    bitcoinBalance: bitcoinBalance,
    dollarBalanceSat: dollarBalanceSat,

    min_usd_swap_amount: min_usd_swap_amount,
    swapLimits: swapLimits,

    isUsingLRC20: false,

    canEditAmount: true,

    t,

    masterInfoObject,
    fiatStats,
    inputDenomination: primaryDisplay.denomination,
    primaryDisplay,
    conversionFiatStats,

    sparkInformation,
  });

  const handleSelectPaymentMethod = useCallback(() => {
    if (paymentType === 'send' || paymentType === 'Gift') {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'SelectPaymentMethod',
        selectedPaymentMethod: selectedPaymentMethod,
        fromPage: 'SendAndRequestPage',
      });
    } else {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'SelectContactRequestCurrency',
        selectedRecieveOption: selectedRequestMethod,
      });
    }
  }, [navigate, selectedPaymentMethod, selectedRequestMethod]);

  useEffect(() => {
    if (!giftOption) {
      setAmountValue('');
      return;
    }
    const totalSats = Math.round(
      giftOption.selectedDenomination * giftOption.satsPerDollar,
    );
    const localfiatSatsPerDollar =
      (primaryDisplay.forceFiatStats?.value || fiatStats.value) /
      SATSPERBITCOIN;
    setAmountValue(
      String(
        primaryDisplay.denomination !== 'fiat'
          ? totalSats
          : Math.round(localfiatSatsPerDollar * totalSats),
      ),
    );
  }, [giftOption]);

  const canProceed =
    paymentType === 'request' ? !!amountValue : paymentValidation.canProceed;

  const handleDenominationToggle = () => {
    if (isDescriptionFocused) return;
    if (paymentType === 'Gift') {
      const nextDenom = getNextDenomination();
      setInputDenomination(nextDenom);
    } else {
      const nextDenom = getNextDenomination();
      setInputDenomination(nextDenom);
      setAmountValue(convertForToggle(amountValue, convertTextInputValue));
    }
  };

  const handleSubmit = useCallback(async () => {
    try {
      if (!canProceed) {
        const error = paymentValidation.getErrorMessage(
          paymentValidation.primaryError,
        );
        navigate.navigate('ErrorScreen', {
          errorMessage: error,
        });
        return;
      }
      if (!isConnectedToTheInternet) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('errormessages.nointernet'),
        });
        return;
      }
      crashlyticsLogReport('Submitting send and request payment');
      setIsLoading(true);

      const sendingAmountMsat = convertedSendAmount * 1000;
      const contactMessage = descriptionValue;
      const myProfileMessage = !!descriptionValue
        ? descriptionValue
        : t('contacts.sendAndRequestPage.profileMessage', {
            name: selectedContact.name || selectedContact.uniqueName,
          });
      const payingContactMessage = !!descriptionValue
        ? descriptionValue
        : {
            usingTranslation: true,
            type: 'paid',
            name:
              globalContactsInformation.myProfile.name ||
              globalContactsInformation.myProfile.uniqueName,
          };

      const currentTime = getServerTime();
      const UUID = customUUID();
      let sendObject = {};

      if (globalContactsInformation.myProfile.uniqueName) {
        sendObject['senderProfileSnapshot'] = {
          uniqueName: globalContactsInformation.myProfile.uniqueName,
        };
      }

      if (giftOption) {
        const retrivedContact = await getDataFromCollection(
          'blitzWalletUsers',
          selectedContact.uuid,
        );
        if (!retrivedContact) {
          navigate.navigate('ErrorScreen', {
            errorMessage: 'errormessages.fullDeeplinkError',
          });
          return;
        }
        if (!retrivedContact.enabledGiftCards) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t(
              'contacts.sendAndRequestPage.giftCardappVersionError',
            ),
          });
          return;
        }

        const postData = {
          type: 'buyGiftCard',
          productId: giftOption.id, //string
          cardValue: giftOption.selectedDenomination, //number
          quantity: Number(1), //number
        };

        const response = await fetchBackend(
          'theBitcoinCompanyV3',
          postData,
          contactsPrivateKey,
          publicKey,
        );

        if (response.result) {
          const { amount, invoice, orderId, uuid } = response.result;
          const fiatRates = await (fiatStats.coin?.toLowerCase() === 'usd'
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

          const sendingAmountSat = amount;
          const isOverDailyLimit = await giftCardPurchaseAmountTracker({
            sendingAmountSat: sendingAmountSat,
            USDBTCValue: USDBTCValue,
            testOnly: true,
          });

          if (isOverDailyLimit.shouldBlock) {
            navigate.navigate('ErrorScreen', {
              errorMessage: isOverDailyLimit.reason,
            });
            return;
          }

          sendObject['amountMsat'] = amount;
          sendObject['description'] = descriptionValue || '';
          sendObject['uuid'] = UUID;
          sendObject['isRequest'] = false;
          sendObject['isRedeemed'] = null;
          sendObject['wasSeen'] = null;
          sendObject['didSend'] = null;
          sendObject['giftCardInfo'] = {
            amount,
            invoice,
            orderId,
            uuid,
            logo: giftOption.logo,
            name: giftOption.name,
          };

          navigate.navigate('ConfirmPaymentScreen', {
            btcAdress: invoice,
            comingFromAccept: true,
            enteredPaymentInfo: {
              fromContacts: true,
              amount: amount,
              description:
                descriptionValue ||
                t('contacts.sendAndRequestPage.giftCardDescription', {
                  name: selectedContact.name || selectedContact.uniqueName,
                  giftCardName: giftOption.name,
                }),
            },
            contactInfo: {
              imageData,
              name: selectedContact.name || selectedContact.uniqueName,
              uniqueName: selectedContact.uniqueName,
              uuid: selectedContact.uuid,
            },
            preSelectedPaymentMethod: selectedPaymentMethod,
            selectedPaymentMethod: selectedPaymentMethod,
            fromPage: 'contacts',
            publishMessageFunc: () => {
              giftCardPurchaseAmountTracker({
                sendingAmountSat: sendingAmountSat,
                USDBTCValue: USDBTCValue,
              });
              publishMessage({
                toPubKey: selectedContact.uuid,
                fromPubKey: globalContactsInformation.myProfile.uuid,
                data: sendObject,
                globalContactsInformation,
                selectedContact,
                isLNURLPayment: false,
                privateKey: contactsPrivateKey,
                retrivedContact,
                currentTime,
                masterInfoObject,
              });
            },
          });
        } else {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('contacts.sendAndRequestPage.cardDetailsError'),
          });
        }
        return;
      }

      const {
        receiveAddress,
        retrivedContact,
        didWork,
        error,
        formattedPayingContactMessage,
      } = await getReceiveAddressAndContactForContactsPayment({
        sendingAmountSat: convertedSendAmount,
        selectedContact,
        myProfileMessage,
        payingContactMessage,
        onlyGetContact: paymentType !== 'send',
      });

      if (!didWork) {
        navigate.navigate('ErrorScreen', {
          errorMessage: error,
          useTranslationString: true,
        });
        return;
      }

      sendObject['amountMsat'] = sendingAmountMsat;
      sendObject['uuid'] = UUID;
      sendObject['wasSeen'] = null;
      sendObject['didSend'] = null;
      sendObject['isRedeemed'] = null;

      if (paymentType === 'send') {
        sendObject['description'] = contactMessage;
        sendObject['isRequest'] = false;
        sendObject['paymentDenomination'] = endReceiveType;
        sendObject['amountDollars'] =
          endReceiveType === 'USD'
            ? satsToDollars(
                convertedSendAmount,
                poolInfoRefSnapshotRef.current.currentPriceAInB,
              ).toFixed(2)
            : null;

        navigate.navigate('ConfirmPaymentScreen', {
          btcAdress: receiveAddress,
          comingFromAccept: true,
          enteredPaymentInfo: {
            fromContacts: true,
            amount: convertedSendAmount,
            description: myProfileMessage,
            endReceiveType: endReceiveType,
          },
          contactInfo: {
            imageData,
            name: selectedContact.name || selectedContact.uniqueName,
            isLNURLPayment: selectedContact?.isLNURL,
            payingContactMessage: formattedPayingContactMessage, //handles remote tx description
            uniqueName: retrivedContact?.contacts?.myProfile?.uniqueName,
            uuid: selectedContact.uuid,
          },
          preSelectedPaymentMethod: selectedPaymentMethod,
          selectedPaymentMethod: selectedPaymentMethod,
          fromPage: 'contacts',
          publishMessageFunc: txid =>
            publishMessage({
              toPubKey: selectedContact.uuid,
              fromPubKey: globalContactsInformation.myProfile.uuid,
              data: {
                ...sendObject,
                txid,
                name:
                  globalContactsInformation.myProfile.name ||
                  globalContactsInformation.myProfile.uniqueName,
              },
              globalContactsInformation,
              selectedContact,
              isLNURLPayment: selectedContact?.isLNURL,
              privateKey: contactsPrivateKey,
              retrivedContact,
              currentTime,
              masterInfoObject,
            }),
        });
      } else {
        sendObject['amountDollars'] =
          selectedRequestMethod === 'USD'
            ? satsToDollars(
                convertedSendAmount,
                poolInfoRefSnapshotRef.current.currentPriceAInB,
              ).toFixed(2)
            : null;
        sendObject['description'] = descriptionValue;
        sendObject['isRequest'] = true;
        sendObject['paymentDenomination'] = selectedRequestMethod;

        await publishMessage({
          toPubKey: selectedContact.uuid,
          fromPubKey: globalContactsInformation.myProfile.uuid,
          data: sendObject,
          globalContactsInformation,
          selectedContact,
          isLNURLPayment: selectedContact?.isLNURL,
          privateKey: contactsPrivateKey,
          retrivedContact,
          currentTime,
          masterInfoObject,
        });

        navigate.goBack();
      }
    } catch (err) {
      console.log(err, 'publishing message error');
      navigate.navigate('ErrorScreen', {
        errorMessage: selectedContact.isLNURL
          ? t('errormessages.contactInvoiceGenerationError')
          : t('errormessages.invoiceRetrivalError'),
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    isConnectedToTheInternet,
    convertedSendAmount,
    canProceed,
    selectedContact,
    navigate,
    contactsPrivateKey,
    descriptionValue,
    paymentType,
    globalContactsInformation,
    getServerTime,
    giftOption,
    masterInfoObject,
    fiatStats,
    imageData,
    paymentValidation,
    selectedPaymentMethod,
    primaryDisplay,
    isUSDMode,
    inputDenomination,
  ]);

  const handleEmoji = newDescription => {
    setDescriptionValue(newDescription);
  };

  return (
    <CustomKeyboardAvoidingView
      globalThemeViewStyles={{
        paddingBottom: !isDescriptionFocused ? bottomPadding : 0,
      }}
    >
      <View
        style={[
          styles.replacementContainer,
          isDescriptionFocused ? { flexShrink: 1 } : { flexGrow: 1 },
        ]}
      >
        <CustomSettingsTopBar
          label={
            paymentType === 'send'
              ? t('constants.send')
              : paymentType === 'Gift'
              ? t('constants.gift')
              : t('constants.request')
          }
          containerStyles={{ marginBottom: 0 }}
        />
        <ThemeText
          styles={{
            textAlign: 'center',
            opacity: 0.7,
          }}
          content={
            paymentType === 'send'
              ? t(
                  `constants.${
                    selectedPaymentMethod === 'USD'
                      ? 'dollars_upper'
                      : 'bitcoin_upper'
                  }`,
                )
              : paymentType === 'Gift'
              ? ''
              : t(
                  `constants.${
                    selectedRequestMethod === 'USD'
                      ? 'dollars_upper'
                      : 'bitcoin_upper'
                  }`,
                )
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollViewContainer,
            paymentType === 'Gift' && { justifyContent: 'flex-start' },
            {
              opacity:
                !isDescriptionFocused || paymentType === 'Gift'
                  ? 1
                  : HIDDEN_OPACITY,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleDenominationToggle}
          >
            <FormattedBalanceInput
              maxWidth={0.9}
              amountValue={displayAmount || 0}
              inputDenomination={primaryDisplay.denomination}
              forceCurrency={primaryDisplay.forceCurrency}
              forceFiatStats={primaryDisplay.forceFiatStats}
            />

            <FormattedSatText
              containerStyles={{
                ...styles.convertedAmount,
                opacity: !amountValue ? HIDDEN_OPACITY : 1,
              }}
              neverHideBalance={true}
              globalBalanceDenomination={secondaryDisplay.denomination}
              forceCurrency={secondaryDisplay.forceCurrency}
              forceFiatStats={secondaryDisplay.forceFiatStats}
              balance={convertedSendAmount}
            />
          </TouchableOpacity>

          {giftOption && (
            <>
              <View style={styles.giftAmountContainer}>
                <TouchableOpacity
                  onPress={() =>
                    navigate.navigate('CustomHalfModal', {
                      wantedContent: 'giftCardSendAndReceiveOption',
                      uuid: selectedContact.uuid,
                      selectedContact,
                      imageData,
                    })
                  }
                  style={[
                    styles.pill,
                    {
                      // borderColor: backgroundOffset,
                      backgroundColor: theme
                        ? backgroundOffset
                        : COLORS.darkModeText,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.logoContainer,
                      {
                        backgroundColor: theme
                          ? COLORS.darkModeText
                          : backgroundColor,
                      },
                    ]}
                  >
                    <Image
                      style={styles.cardLogo}
                      source={{ uri: giftOption.logo }}
                      contentFit="contain"
                    />
                  </View>
                  <ThemeText
                    CustomNumberOfLines={1}
                    styles={styles.pillText}
                    content={t('contacts.sendAndRequestPage.giftCardText', {
                      giftName: giftOption.name,
                    })}
                  />

                  <View style={[styles.editButton]}>
                    <ThemeIcon
                      colorOverride={textColor}
                      size={18}
                      iconName={'SquarePen'}
                    />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.memoSection}
                  activeOpacity={giftOption.memo ? 1 : 0.2}
                >
                  <ThemeText
                    styles={styles.memoLabel}
                    content={t('contacts.sendAndRequestPage.giftMessage')}
                  />
                  <CustomSearchInput
                    textInputMultiline={true}
                    placeholderText={t(
                      'contacts.sendAndRequestPage.giftMessagePlaceholder',
                    )}
                    onFocusFunction={() => setIsDescriptionFocused(true)}
                    onBlurFunction={() => setIsDescriptionFocused(false)}
                    inputText={descriptionValue}
                    setInputText={setDescriptionValue}
                    maxLength={500}
                    textInputStyles={{ minHeight: 100 }}
                    textAlignVertical="top"
                  />
                </TouchableOpacity>

                {paymentType === 'Gift' && (
                  <View>
                    <ThemeText
                      styles={styles.memoLabel}
                      content={t(
                        'contacts.sendAndRequestPage.paymentSourceHeader',
                      )}
                    />

                    <ChoosePaymentMethod
                      theme={theme}
                      darkModeType={darkModeType}
                      determinePaymentMethod={
                        paymentType === 'send' || paymentType === 'Gift'
                          ? selectedPaymentMethod
                          : selectedRequestMethod
                      }
                      handleSelectPaymentMethod={handleSelectPaymentMethod}
                      bitcoinBalance={sparkInformation.balance}
                      dollarBalanceToken={dollarBalanceToken}
                      masterInfoObject={masterInfoObject}
                      fiatStats={fiatStats}
                      uiState={
                        paymentType === 'send' || paymentType === 'Gift'
                          ? 'SELECT_INLINE'
                          : 'CONTACT_REQUEST'
                      }
                      t={t}
                      selectedMethod={
                        paymentType === 'send' || paymentType === 'Gift'
                          ? selectedPaymentMethod
                          : selectedRequestMethod
                      }
                      containerStyles={{ width: '100%', marginTop: 0 }}
                    />
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
        {paymentType !== 'Gift' && (
          <View style={styles.inputAndGiftContainer}>
            {paymentType === 'send' && (
              <ChoosePaymentMethod
                theme={theme}
                darkModeType={darkModeType}
                determinePaymentMethod={
                  paymentType === 'send' || paymentType === 'Gift'
                    ? selectedPaymentMethod
                    : selectedRequestMethod
                }
                handleSelectPaymentMethod={handleSelectPaymentMethod}
                bitcoinBalance={sparkInformation.balance}
                dollarBalanceToken={dollarBalanceToken}
                masterInfoObject={masterInfoObject}
                fiatStats={fiatStats}
                uiState={
                  paymentType === 'send' || paymentType === 'Gift'
                    ? 'SELECT_INLINE'
                    : 'CONTACT_REQUEST'
                }
                t={t}
                selectedMethod={
                  paymentType === 'send' || paymentType === 'Gift'
                    ? selectedPaymentMethod
                    : selectedRequestMethod
                }
                containerStyles={{ width: '100%', marginBottom: 8 }}
              />
            )}

            <CustomSearchInput
              onFocusFunction={() => {
                setIsDescriptionFocused(true);
              }}
              onBlurFunction={() => {
                setIsDescriptionFocused(false);
              }}
              textInputRef={descriptionRef}
              placeholderText={t('constants.paymentDescriptionPlaceholder')}
              placeholderTextColor={
                theme && !darkModeType
                  ? undefined
                  : theme
                  ? COLORS.lightsOutModeOpacityInput
                  : COLORS.opaicityGray
              }
              editable={paymentType === 'send' ? true : !!convertedSendAmount}
              containerStyles={styles.descriptionInput}
              setInputText={setDescriptionValue}
              inputText={descriptionValue}
              textInputMultiline={true}
              textAlignVertical={'center'}
              maxLength={149}
            />
          </View>
        )}

        {!isDescriptionFocused && (
          <View>
            {paymentType !== 'Gift' && (
              <CustomNumberKeyboard
                showDot={primaryDisplay.denomination === 'fiat'}
                frompage="sendContactsPage"
                setInputValue={setAmountValue}
                usingForBalance={true}
                fiatStats={conversionFiatStats}
              />
            )}
            <CustomButton
              buttonStyles={{
                ...styles.button,
                opacity: canProceed ? 1 : HIDDEN_OPACITY,
              }}
              useLoading={isLoading}
              actionFunction={handleSubmit}
              textContent={
                paymentType === 'send' || paymentType === 'Gift'
                  ? t('constants.continue')
                  : t('constants.request')
              }
            />
          </View>
        )}
      </View>

      {isDescriptionFocused && (
        <EmojiQuickBar
          description={descriptionValue}
          onEmojiSelect={handleEmoji}
        />
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  replacementContainer: {
    flexGrow: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  scrollViewContainer: {
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  convertedAmount: {
    marginBottom: 16,
  },
  inputAndGiftContainer: {
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
  },
  giftAmountContainer: {
    width: INSET_WINDOW_WIDTH,
    marginTop: 20,
    gap: 20,
  },
  giftAmountText: {
    textAlign: 'center',
  },
  giftContainer: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  giftText: {
    marginRight: 8,
    includeFontPadding: false,
  },
  button: {
    width: 'auto',
    ...CENTER,
  },
  pill: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 16,
    alignSelf: 'center',
    position: 'relative',
  },
  logoContainer: {
    width: 48,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.darkModeText,
    borderRadius: 12,
    padding: 6,
  },
  cardLogo: {
    width: '100%',
    height: '100%',
    maxWidth: 80,
    maxHeight: 80,
    borderRadius: 8,
  },
  pillText: {
    flexShrink: 1,
    includeFontPadding: false,
    fontSize: SIZES.medium,
    marginRight: 20,
  },
  editButton: {
    width: 32,
    height: 32,
    // borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    // position: 'absolute',
    // right: -8,
    // top: -8,
    // borderWidth: 3,
    marginLeft: 'auto',
  },
  editIcon: {
    width: 18,
    height: 18,
  },
  memoSection: {
    // marginTop: 18,
  },
  memoLabel: {
    marginBottom: 10,
    opacity: 0.8,
    fontSize: SIZES.smedium,
  },
  memoContainer: {
    // padding: 15,
    // borderRadius: 8,
    // borderWidth: 1,

    justifyContent: 'center',
  },
  memoText: {
    lineHeight: 22,
    letterSpacing: 0.3,
    fontSize: SIZES.medium,
  },
  descriptionInput: {
    maxWidth: 350,
    marginTop: 8,
  },
});
