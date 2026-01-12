import { StyleSheet, ScrollView, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  HIDE_IN_APP_PURCHASE_ITEMS,
  ICONS,
  QUICK_PAY_STORAGE_KEY,
  SATSPERBITCOIN,
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
import Icon from '../../../../functions/CustomElements/Icon';
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
import { dollarsToSats } from '../../../../functions/spark/flashnet';
import ChoosePaymentMethod from '../sendBitcoin/components/choosePaymentMethodContainer';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
const MAX_SEND_OPTIONS = [
  { label: '25%', value: '25' },
  { label: '50%', value: '50' },
  { label: '75%', value: '75' },
  { label: '100%', value: '100' },
];

export default function SendAndRequestPage(props) {
  const navigate = useNavigation();
  const { dollarBalanceSat, dollarBalanceToken } = useUserBalanceContext();
  const { poolInfoRef, swapLimits } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation } = useSparkWallet();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { isConnectedToTheInternet, screenDimensions } = useAppStatus();
  const { fiatStats } = useNodeContext();
  // const {minMaxLiquidSwapAmounts} = useAppStatus();
  const { globalContactsInformation } = useGlobalContacts();
  const getServerTime = useServerTimeOnly();
  const [amountValue, setAmountValue] = useState('');
  const [isAmountFocused, setIsAmountFocused] = useState(true);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination,
  );
  const { bottomPadding } = useGlobalInsets();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const descriptionRef = useRef(null);
  const [isGettingMax, setIsGettingMax] = useState(false);

  const selectedPaymentMethod =
    props.route.params.selectedPaymentMethod || 'BTC';

  const selectedContact = props.route.params.selectedContact;
  const paymentType = props.route.params.paymentType;
  const fromPage = props.route.params.fromPage;
  const imageData = props.route.params.imageData;
  const giftOption = props.route.params.cardInfo;
  const useAltLayout = screenDimensions.height < 720;

  const isBTCdenominated =
    inputDenomination == 'hidden' || inputDenomination == 'sats';

  const convertedSendAmount = useMemo(
    () =>
      (isBTCdenominated
        ? Math.round(amountValue)
        : Math.round((SATSPERBITCOIN / fiatStats?.value) * amountValue)) || 0,
    [amountValue, fiatStats, isBTCdenominated],
  );

  const switchTextToConfirm = useMemo(() => {
    return (
      masterInfoObject[QUICK_PAY_STORAGE_KEY].isFastPayEnabled &&
      convertedSendAmount <=
        masterInfoObject[QUICK_PAY_STORAGE_KEY].fastPayThresholdSats
    );
  }, [convertedSendAmount]);

  const handleSelctProcesss = useCallback(
    async item => {
      try {
        const balance = sparkInformation.balance;
        const selectedPercent = !item ? 100 : Number(item.value);

        const sendingBalance = Math.floor(balance * (selectedPercent / 100));

        setIsGettingMax(true);
        // small pause for UI
        await new Promise(res => setTimeout(res, 250));

        let maxAmountSats = 0;

        // get fake invoice to get payment fee
        if (selectedContact.isLNURL) {
          const [username, domain] = selectedContact.receiveAddress.split('@');
          const lnurlResposne = await getBolt11InvoiceForContact(
            username,
            sendingBalance,
            undefined,
            false,
            domain,
          );
          if (!lnurlResposne) throw new Error('Unable to get invoice');
          const invoice = lnurlResposne;
          // get routing fee for balance amount
          const fee = await sparkPaymenWrapper({
            getFee: true,
            address: invoice,
            masterInfoObject,
            paymentType: 'lightning',
            mnemonic: currentWalletMnemoinc,
          });

          if (!fee.didWork) throw new Error(fee.error);

          // subtract routing fee from balance to get max sending amount
          maxAmountSats = Math.max(
            Number(sendingBalance) - fee.fee + fee.supportFee,
            0,
          );
        } else {
          // contact payments now use spark
          const feeResponse = await sparkPaymenWrapper({
            getFee: true,
            address: sparkInformation.sparkAddress,
            masterInfoObject,
            paymentType: 'spark',
            amountSats: sendingBalance,
            mnemonic: currentWalletMnemoinc,
          });
          if (!feeResponse.didWork) throw new Error('Unable to get invoice');
          maxAmountSats = Math.max(
            Number(sendingBalance) - feeResponse.fee + feeResponse.supportFee,
            0,
          );
        }

        const convertedMax =
          inputDenomination != 'fiat'
            ? Math.floor(Number(maxAmountSats))
            : (
                Number(maxAmountSats) /
                Math.floor(SATSPERBITCOIN / fiatStats?.value)
              ).toFixed(2);

        setAmountValue(convertedMax);
      } catch (err) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('errormessages.genericError'),
        });
      } finally {
        setIsGettingMax(false);
      }
    },
    [
      sparkInformation,
      inputDenomination,
      currentWalletMnemoinc,
      selectedContact,
    ],
  );

  const min_usd_swap_amount = useMemo(() => {
    return Math.round(
      dollarsToSats(swapLimits.usd, poolInfoRef.currentPriceAInB),
    );
  }, [poolInfoRef.currentPriceAInB, swapLimits]);

  const {
    determinePaymentMethod,
    needsToChoosePaymentMethod,
    finalPaymentMethod,
  } = usePaymentMethodSelection({
    paymentInfo: {
      paymentNetwork: giftOption ? 'lightning' : 'spark',
      data: {
        expectedReceive: 'sats',
      },
    },
    convertedSendAmount,
    paymentFee: 0,
    sparkBalance: sparkInformation.balance,
    bitcoinBalance: sparkInformation.balance,
    dollarBalanceSat,
    dollarBalanceToken,
    min_usd_swap_amount,
    swapLimits,
    isUsingLRC20: false,
    useFullTokensDisplay: false,
    selectedPaymentMethod,
  });

  const handleSelectPaymentMethod = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'SelectPaymentMethod',
      selectedPaymentMethod: determinePaymentMethod,
      fromPage: 'SendAndRequestPage',
    });
  }, [navigate, determinePaymentMethod]);

  useEffect(() => {
    if (!giftOption) {
      setAmountValue('');
      return;
    }
    const totalSats = Math.round(
      giftOption.selectedDenomination * giftOption.satsPerDollar,
    );
    const localfiatSatsPerDollar = fiatStats.value / SATSPERBITCOIN;
    setAmountValue(
      String(
        isBTCdenominated
          ? totalSats
          : Math.round(localfiatSatsPerDollar * totalSats),
      ),
    );
  }, [giftOption]);

  const handleSearch = useCallback(term => {
    setAmountValue(term);
  }, []);

  const getValidationError = useMemo(() => {
    if (!convertedSendAmount) {
      return t('wallet.sendPages.acceptButton.noSendAmountError');
    }

    // Check if payment method selection is needed but not chosen
    if (needsToChoosePaymentMethod && !selectedPaymentMethod) {
      return t('wallet.sendPages.sendPaymentScreen.selectPaymentMethod');
    }

    const methodToCheck = finalPaymentMethod || selectedPaymentMethod;

    // Validate swap limits when using USD
    if (methodToCheck === 'USD') {
      // USD → BTC requires meeting minimum swap amount
      if (convertedSendAmount < min_usd_swap_amount) {
        return t('wallet.sendPages.acceptButton.swapMinimumError', {
          amount: displayCorrectDenomination({
            amount: min_usd_swap_amount,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: inputDenomination,
            },
            fiatStats,
          }),
          currency1: t('constants.dollars_upper'),
          currency2: t('constants.bitcoin_upper'),
        });
      }
    }

    // Validate balance sufficiency
    const balanceToCheck =
      methodToCheck === 'USD' ? dollarBalanceSat : sparkInformation.balance;

    // Add approximate fee buffer (estimate ~2% for routing)
    const estimatedFee = Math.ceil(convertedSendAmount * 0.015);
    const totalNeeded = convertedSendAmount + estimatedFee;

    if (balanceToCheck < totalNeeded) {
      // Check if total balance across both would be sufficient
      const totalBalance = dollarBalanceSat + sparkInformation.balance;

      if (totalBalance >= totalNeeded) {
        return t('wallet.sendPages.acceptButton.balanceFragmentationError');
      }

      return t('wallet.sendPages.acceptButton.balanceError');
    }

    return null;
  }, [
    convertedSendAmount,
    needsToChoosePaymentMethod,
    selectedPaymentMethod,
    finalPaymentMethod,
    min_usd_swap_amount,
    dollarBalanceSat,
    sparkInformation.balance,
    inputDenomination,
    masterInfoObject,
    fiatStats,
    t,
  ]);

  const canSendPayment = !getValidationError;

  const handleSubmit = useCallback(async () => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    try {
      if (!canSendPayment) {
        navigate.navigate('ErrorScreen', {
          errorMessage: getValidationError,
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
          sendObject['description'] = giftOption.memo || '';
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

      if (paymentType === 'send') {
        sendObject['amountMsat'] = sendingAmountMsat;
        sendObject['description'] = contactMessage;
        sendObject['uuid'] = UUID;
        sendObject['isRequest'] = false;
        sendObject['isRedeemed'] = null;
        sendObject['wasSeen'] = null;
        sendObject['didSend'] = null;

        navigate.navigate('ConfirmPaymentScreen', {
          btcAdress: receiveAddress,
          comingFromAccept: true,
          enteredPaymentInfo: {
            amount: sendingAmountMsat / 1000,
            description: myProfileMessage, //hanldes local tx description
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
        sendObject['amountMsat'] = sendingAmountMsat;
        sendObject['description'] = descriptionValue;
        sendObject['uuid'] = UUID;
        sendObject['isRequest'] = true;
        sendObject['isRedeemed'] = null;
        sendObject['wasSeen'] = null;
        sendObject['didSend'] = null;

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
    canSendPayment,
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
    getValidationError,
    selectedPaymentMethod,
  ]);

  const memorizedContainerStyles = useMemo(() => {
    return {
      flex: 0,
      borderRadius: 8,
      height: 'unset',
      minWidth: 'unset',
      justifyContent: 'center',
    };
  }, []);

  const handleEmoji = newDescription => {
    setDescriptionValue(newDescription);
  };

  return (
    <>
      <CustomKeyboardAvoidingView
        globalThemeViewStyles={{
          paddingBottom: !isAmountFocused ? 0 : bottomPadding,
        }}
      >
        <View style={styles.replacementContainer}>
          {paymentType === 'send' ? (
            <NavBarWithBalance showBalance={paymentType === 'send'} />
          ) : (
            <CustomSettingsTopBar
              label={t('constants.request')}
              containerStyles={{ marginBottom: 0 }}
            />
          )}

          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.scrollViewContainer,
                { opacity: isAmountFocused ? 1 : HIDDEN_OPACITY },
              ]}
            >
              <FormattedBalanceInput
                maxWidth={0.9}
                amountValue={amountValue || 0}
                inputDenomination={inputDenomination}
                containerFunction={() => {
                  if (!isAmountFocused) return;
                  setInputDenomination(prev => {
                    const newPrev =
                      prev === 'sats' || prev === 'hidden' ? 'fiat' : 'sats';
                    return newPrev;
                  });
                  setAmountValue(
                    convertTextInputValue(
                      amountValue,
                      fiatStats,
                      inputDenomination,
                    ),
                  );
                }}
              />

              <FormattedSatText
                containerStyles={{
                  ...styles.convertedAmount,
                  opacity: !amountValue ? HIDDEN_OPACITY : 1,
                }}
                neverHideBalance={true}
                globalBalanceDenomination={isBTCdenominated ? 'fiat' : 'sats'}
                balance={convertedSendAmount}
              />

              {/* Send Max Button */}
              {/* {paymentType === 'send' && !giftOption && !useAltLayout && (
                <View>
                  <DropdownMenu
                    selectedValue={t(
                      `wallet.sendPages.sendMaxComponent.${'sendMax'}`,
                    )}
                    onSelect={handleSelctProcesss}
                    options={MAX_SEND_OPTIONS}
                    showClearIcon={false}
                    textStyles={styles.sendMaxText}
                    showVerticalArrows={false}
                    customButtonStyles={memorizedContainerStyles}
                    useIsLoading={isGettingMax}
                  />
                </View>
              )} */}

              {giftOption && (
                <>
                  <View style={styles.giftAmountContainer}>
                    <TouchableOpacity
                      onPress={() =>
                        navigate.navigate('CustomHalfModal', {
                          wantedContent: 'giftCardSendAndReceiveOption',
                        })
                      }
                      style={[
                        styles.pill,
                        {
                          borderColor: backgroundOffset,
                          backgroundColor: theme
                            ? backgroundOffset
                            : backgroundOffset,
                        },
                      ]}
                    >
                      <View style={styles.logoContainer}>
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
                      <View
                        style={[
                          styles.editButton,
                          {
                            backgroundColor: backgroundOffset,
                            borderColor: backgroundColor,
                          },
                        ]}
                      >
                        <ThemeImage
                          styles={styles.editIcon}
                          lightModeIcon={ICONS.editIcon}
                          darkModeIcon={ICONS.editIconLight}
                          lightsOutIcon={ICONS.editIconLight}
                        />
                      </View>
                    </TouchableOpacity>
                    {giftOption.memo && (
                      <View style={styles.memoSection}>
                        <ThemeText
                          styles={styles.memoLabel}
                          content={t('contacts.sendAndRequestPage.giftMessage')}
                        />
                        <View
                          style={[
                            styles.memoContainer,
                            {
                              backgroundColor: theme
                                ? backgroundOffset
                                : COLORS.darkModeText,
                              borderColor: theme
                                ? backgroundOffset
                                : 'rgba(255,255,255,0.1)',
                            },
                          ]}
                        >
                          <ThemeText
                            styles={styles.memoText}
                            content={giftOption.memo}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                </>
              )}
            </ScrollView>

            {!giftOption && (
              <>
                <View style={styles.inputAndGiftContainer}>
                  {paymentType === 'send' &&
                    !giftOption &&
                    !selectedContact?.isLNURL &&
                    !HIDE_IN_APP_PURCHASE_ITEMS && (
                      <TouchableOpacity
                        onPress={() =>
                          navigate.navigate('SelectGiftCardForContacts')
                        }
                        style={[
                          styles.giftContainer,
                          {
                            backgroundColor: backgroundOffset,
                            marginBottom: useAltLayout
                              ? 0
                              : CONTENT_KEYBOARD_OFFSET,
                          },
                        ]}
                      >
                        <ThemeText
                          styles={styles.giftText}
                          content={t(
                            'contacts.sendAndRequestPage.sendGiftText',
                          )}
                        />
                        <ThemeImage
                          styles={{
                            width: 20,
                            height: 20,
                            tintColor: textColor,
                          }}
                          disableTint={true}
                          source={ICONS.giftCardIcon}
                        />
                      </TouchableOpacity>
                    )}
                  {paymentType === 'send' && (
                    <ChoosePaymentMethod
                      theme={theme}
                      darkModeType={darkModeType}
                      determinePaymentMethod={determinePaymentMethod}
                      handleSelectPaymentMethod={handleSelectPaymentMethod}
                      bitcoinBalance={sparkInformation.balance}
                      dollarBalanceToken={dollarBalanceToken}
                      masterInfoObject={masterInfoObject}
                      fiatStats={fiatStats}
                      uiState="SELECT_INLINE"
                      t={t}
                      selectedMethod={selectedPaymentMethod}
                      containerStyles={{ width: '100%' }}
                    />
                  )}
                  <CustomSearchInput
                    onFocusFunction={() => {
                      setIsAmountFocused(false);
                    }}
                    onBlurFunction={() => {
                      setIsAmountFocused(true);
                    }}
                    textInputRef={descriptionRef}
                    placeholderText={t(
                      'contacts.sendAndRequestPage.descriptionPlaceholder',
                    )}
                    textInputStyles={{
                      borderRadius: useAltLayout ? 15 : 8,
                      height: useAltLayout ? 50 : 'unset',
                    }}
                    placeholderTextColor={
                      theme && !darkModeType
                        ? undefined
                        : theme
                        ? COLORS.lightsOutModeOpacityInput
                        : COLORS.opaicityGray
                    }
                    editable={
                      paymentType === 'send' ? true : !!convertedSendAmount
                    }
                    containerStyles={styles.descriptionInput}
                    setInputText={setDescriptionValue}
                    inputText={descriptionValue}
                    textInputMultiline={true}
                    textAlignVertical={'center'}
                    maxLength={149}
                  />

                  {useAltLayout && (
                    <View style={styles.maxAndAcceptContainer}>
                      <View
                        style={{
                          flexShrink: useAltLayout ? 0 : 1,
                          marginRight: useAltLayout ? 10 : 0,
                          marginBottom: useAltLayout ? 0 : 20,
                          alignSelf: useAltLayout ? 'auto' : 'center',
                        }}
                      >
                        <DropdownMenu
                          selectedValue={t(
                            `wallet.sendPages.sendMaxComponent.${'sendMaxShort'}`,
                          )}
                          onSelect={handleSelctProcesss}
                          options={MAX_SEND_OPTIONS}
                          showClearIcon={false}
                          textStyles={styles.sendMaxText}
                          showVerticalArrows={false}
                          customButtonStyles={{
                            flex: 0,
                            borderRadius: useAltLayout ? 30 : 8,
                            height: useAltLayout ? 50 : 'unset',
                            minWidth: useAltLayout ? 70 : 'unset',
                            justifyContent: 'center',
                          }}
                        />
                      </View>

                      <CustomButton
                        buttonStyles={{
                          borderRadius: useAltLayout ? 30 : 8,
                          height: useAltLayout ? 50 : 'unset',
                          flexShrink: useAltLayout ? 1 : 0,
                          width: useAltLayout ? '100%' : 'auto',
                          ...CENTER,
                        }}
                        useLoading={isLoading}
                        actionFunction={handleSubmit}
                        textContent={
                          paymentType === 'send'
                            ? t('constants.confirm')
                            : t('constants.request')
                        }
                      />
                    </View>
                  )}
                </View>
                {isAmountFocused && (
                  <CustomNumberKeyboard
                    showDot={
                      masterInfoObject.userBalanceDenomination === 'fiat'
                    }
                    frompage="sendContactsPage"
                    setInputValue={handleSearch}
                    usingForBalance={true}
                    fiatStats={fiatStats}
                  />
                )}
              </>
            )}
            {((isAmountFocused && !useAltLayout) || giftOption) && (
              <CustomButton
                buttonStyles={{
                  ...styles.button,
                  opacity: canSendPayment ? 1 : HIDDEN_OPACITY,
                }}
                useLoading={isLoading}
                actionFunction={handleSubmit}
                textContent={
                  paymentType === 'send'
                    ? switchTextToConfirm && canSendPayment
                      ? t('constants.confirm')
                      : t('constants.review')
                    : t('constants.request')
                }
              />
            )}
          </>
        </View>
        {!isAmountFocused && (
          <EmojiQuickBar
            description={descriptionValue}
            onEmojiSelect={handleEmoji}
          />
        )}
      </CustomKeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  replacementContainer: {
    flexGrow: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  topBar: {
    marginTop: 0,
    marginBottom: 0,
  },
  scrollViewContainer: {
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  sendMaxText: {
    textAlign: 'center',
    includeFontPadding: false,
  },
  convertedAmount: {
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 125,
    backgroundColor: 'red',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    overflow: 'hidden',
  },
  inputAndGiftContainer: {
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
  },
  profileName: {
    ...CENTER,
    marginBottom: 20,
  },
  giftAmountContainer: {
    width: INSET_WINDOW_WIDTH,
    marginTop: 20,
  },
  giftAmountText: {
    textAlign: 'center',
  },
  giftContainer: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
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
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 16,
    borderWidth: 2,
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
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: -8,
    top: -8,
    borderWidth: 3,
  },
  editIcon: {
    width: 18,
    height: 18,
  },
  memoSection: {
    marginTop: 28,
  },
  memoLabel: {
    marginBottom: 10,
    opacity: 0.8,
  },
  memoContainer: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 60,
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
  maxAndAcceptContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
});
