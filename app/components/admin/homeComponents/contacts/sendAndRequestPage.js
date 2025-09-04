import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import {CENTER, ICONS, SATSPERBITCOIN} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {publishMessage} from '../../../../functions/messaging/publishMessage';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import customUUID from '../../../../functions/customUUID';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../context-store/appStatus';
import {useKeysContext} from '../../../../../context-store/keys';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import getReceiveAddressForContactPayment from './internalComponents/getReceiveAddressAndKindForPayment';
import {useServerTimeOnly} from '../../../../../context-store/serverTime';
import {useTranslation} from 'react-i18next';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import Icon from '../../../../functions/CustomElements/Icon';
import GetThemeColors from '../../../../hooks/themeColors';
import {COLORS, INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import fetchBackend from '../../../../../db/handleBackend';
import {getDataFromCollection} from '../../../../../db';

export default function SendAndRequestPage(props) {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {isConnectedToTheInternet} = useAppStatus();
  const {fiatStats} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {globalContactsInformation} = useGlobalContacts();
  const getServerTime = useServerTimeOnly();
  const [amountValue, setAmountValue] = useState('');
  const [isAmountFocused, setIsAmountFocused] = useState(true);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination,
  );
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset, textColor} = GetThemeColors();
  const {t} = useTranslation();
  const descriptionRef = useRef(null);
  const selectedContact = props.route.params.selectedContact;
  const paymentType = props.route.params.paymentType;
  const fromPage = props.route.params.fromPage;
  const giftOption = props.route.params.cardInfo;
  const isBTCdenominated =
    inputDenomination == 'hidden' || inputDenomination == 'sats';

  const convertedSendAmount = useMemo(
    () =>
      (isBTCdenominated
        ? Math.round(amountValue)
        : Math.round((SATSPERBITCOIN / fiatStats?.value) * amountValue)) || 0,
    [amountValue, fiatStats, isBTCdenominated],
  );

  const convertGiftCardAmount = useCallback(
    dollarAmount => {
      console.log(dollarAmount, giftOption);
      const satValue = dollarAmount * giftOption.satsPerDollar;
      return satValue;
    },
    [inputDenomination, giftOption, fiatStats],
  );

  const isWithinGiftLimits = useMemo(() => {
    return (
      !!giftOption &&
      ((convertedSendAmount >=
        Math.floor(giftOption.denominations[0] * giftOption.satsPerDollar) &&
        convertedSendAmount <=
          Math.floor(giftOption.denominations[1] * giftOption.satsPerDollar)) ||
        !giftOption.isVariable)
    );
  }, [giftOption, convertedSendAmount]);

  const canSendPayment = useMemo(
    () =>
      (convertedSendAmount && !giftOption) ||
      (giftOption && isWithinGiftLimits),
    [
      convertedSendAmount,
      minMaxLiquidSwapAmounts,
      paymentType,
      giftOption,
      isWithinGiftLimits,
    ],
  );
  useHandleBackPressNew();

  useEffect(() => {
    if (!giftOption) {
      setAmountValue('');
      return;
    }
    if (!giftOption.isVariable) {
      setAmountValue(
        String(
          isBTCdenominated
            ? Math.round(giftOption.denominations[0] * giftOption.satsPerDollar)
            : giftOption.denominations[0],
        ),
      );
    } else {
      setAmountValue('');
    }
  }, [giftOption]);

  const handleSearch = useCallback(
    term => {
      if (giftOption && !giftOption.isVariable) {
        return;
      }
      setAmountValue(term);
    },
    [giftOption],
  );

  const handleSubmit = useCallback(async () => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    try {
      if (!convertedSendAmount) return;
      if (!canSendPayment) return;
      crashlyticsLogReport('Submitting send and request payment');
      setIsLoading(true);

      const sendingAmountMsat = convertedSendAmount * 1000;
      const address = selectedContact.receiveAddress;

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
          cardValue: Number(convertedSendAmount / giftOption.satsPerDollar), //number
          quantity: Number(1), //number
        };
        const response = await fetchBackend(
          'theBitcoinCompanyV3',
          postData,
          contactsPrivateKey,
          publicKey,
        );

        if (response.result) {
          const {amount, invoice, orderId, uuid} = response.result;

          sendObject['amountMsat'] = amount;
          sendObject['description'] = contactMessage;
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
                t('contacts.sendAndRequestPage.giftCardappVersionError', {
                  name: selectedContact.name || selectedContact.uniqueName,
                  giftCardName: giftOption.name,
                }),
            },
            fromPage: 'contacts',
            publishMessageFunc: () =>
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
              }),
          });
        } else {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('contacts.sendAndRequestPage.cardDetailsError'),
          });
        }

        return;
      }

      let receiveAddress;
      let retrivedContact;
      if (selectedContact.isLNURL) {
        receiveAddress = address;
        retrivedContact = selectedContact;
        // note do not need to set an amount for lnurl taken care of down below with entered payment information object
      } else {
        const addressResposne = await getReceiveAddressForContactPayment(
          convertedSendAmount,
          selectedContact,
          myProfileMessage,
          payingContactMessage,
        );

        if (!addressResposne.didWork) {
          navigate.navigate('ErrorScreen', {
            errorMessage: addressResposne.error,
            useTranslationString: true,
          });
          return;
        } else {
          retrivedContact = addressResposne.retrivedContact;
          receiveAddress = addressResposne.receiveAddress;
        }
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
            description: myProfileMessage,
          },
          fromPage: 'contacts',
          publishMessageFunc: () =>
            publishMessage({
              toPubKey: selectedContact.uuid,
              fromPubKey: globalContactsInformation.myProfile.uuid,
              data: sendObject,
              globalContactsInformation,
              selectedContact,
              isLNURLPayment: selectedContact?.isLNURL,
              privateKey: contactsPrivateKey,
              retrivedContact,
              currentTime,
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
  ]);

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={!isAmountFocused}
      useLocalPadding={true}
      useStandardWidth={true}>
      <CustomSettingsTopBar containerStyles={styles.topBar} />
      <>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContainer}>
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={amountValue || 0}
            inputDenomination={inputDenomination}
            containerFunction={() => {
              setInputDenomination(prev => {
                const newPrev = prev === 'sats' ? 'fiat' : 'sats';

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
              opacity: !amountValue ? 0.5 : 1,
            }}
            neverHideBalance={true}
            globalBalanceDenomination={
              inputDenomination === 'sats' ? 'fiat' : 'sats'
            }
            balance={convertedSendAmount}
          />

          {giftOption && (
            <View
              style={[
                styles.giftAmountContainer,
                {marginTop: giftOption.isVariable ? 20 : 10},
              ]}>
              {giftOption.isVariable && (
                <>
                  {isWithinGiftLimits || !convertedSendAmount ? (
                    <ThemeText
                      styles={styles.giftAmountText}
                      content={t('contacts.sendAndRequestPage.giftCardRange', {
                        amount: displayCorrectDenomination({
                          amount: convertGiftCardAmount(
                            giftOption.denominations[0],
                          ),
                          fiatStats,
                          masterInfoObject: {
                            userBalanceDenomination: inputDenomination,
                            satDisplay: masterInfoObject.satDisplay,
                          },
                        }),
                        amount2: displayCorrectDenomination({
                          amount: convertGiftCardAmount(
                            giftOption.denominations[1],
                          ),
                          fiatStats,
                          masterInfoObject: {
                            userBalanceDenomination: inputDenomination,
                            satDisplay: masterInfoObject.satDisplay,
                          },
                        }),
                      })}
                    />
                  ) : (
                    <ThemeText
                      styles={{
                        ...styles.giftAmountText,
                        color:
                          theme && darkModeType ? textColor : COLORS.cancelRed,
                      }}
                      content={t(
                        'contacts.sendAndRequestPage.giftCardAmountError',
                        {
                          amount: displayCorrectDenomination({
                            amount: convertGiftCardAmount(
                              giftOption.denominations[0],
                            ),
                            fiatStats,
                            masterInfoObject: {
                              userBalanceDenomination: inputDenomination,
                              satDisplay: masterInfoObject.satDisplay,
                            },
                          }),
                          amount2: displayCorrectDenomination({
                            amount: convertGiftCardAmount(
                              giftOption.denominations[1],
                            ),
                            fiatStats,
                            masterInfoObject: {
                              userBalanceDenomination: inputDenomination,
                              satDisplay: masterInfoObject.satDisplay,
                            },
                          }),
                        },
                      )}
                    />
                  )}
                </>
              )}
              <TouchableOpacity
                onPress={() =>
                  navigate.navigate('CustomHalfModal', {
                    wantedContent: 'giftCardSendAndReceiveOption',
                  })
                }
                style={{
                  ...styles.pill,
                  borderColor: backgroundOffset,
                  marginTop: giftOption.isVariable ? 20 : 0,
                }}>
                <View
                  style={[
                    styles.pillLogoContainer,
                    {
                      backgroundColor: theme
                        ? backgroundOffset
                        : COLORS.darkModeText,
                    },
                  ]}>
                  <Image
                    style={styles.giftLogo}
                    source={{uri: giftOption.logo}}
                  />
                </View>
                <ThemeText
                  styles={styles.pillText}
                  content={`${giftOption.name} Gift Card`}
                />
                <View
                  style={{
                    backgroundColor: backgroundOffset,
                    width: 30,
                    height: 30,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    right: -15,
                    top: -15,
                  }}>
                  <ThemeImage
                    styles={{width: 20, height: 20}}
                    lightModeIcon={ICONS.editIcon}
                    darkModeIcon={ICONS.editIconLight}
                    lightsOutIcon={ICONS.editIconLight}
                  />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        <View style={styles.inputAndGiftContainer}>
          {paymentType === 'send' &&
            !giftOption &&
            !selectedContact?.isLNURL && (
              <TouchableOpacity
                onPress={() => navigate.navigate('SelectGiftCardForContacts')}
                style={[
                  styles.giftContainer,
                  {backgroundColor: backgroundOffset},
                ]}>
                <ThemeText
                  styles={styles.giftText}
                  content={t('contacts.sendAndRequestPage.sendGiftText')}
                />
                <Icon color={textColor} name={'giftIcon'} />
              </TouchableOpacity>
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
            containerStyles={{marginTop: 5}}
            setInputText={setDescriptionValue}
            inputText={descriptionValue}
            textInputMultiline={true}
            textAlignVertical={'center'}
            maxLength={149}
          />
        </View>

        {isAmountFocused && (
          <CustomNumberKeyboard
            showDot={masterInfoObject.userBalanceDenomination === 'fiat'}
            frompage="sendContactsPage"
            setInputValue={handleSearch}
            usingForBalance={true}
            fiatStats={fiatStats}
          />
        )}

        {isAmountFocused && (
          <CustomButton
            buttonStyles={{
              opacity: canSendPayment ? 1 : 0.5,
              ...styles.button,
            }}
            useLoading={isLoading}
            actionFunction={handleSubmit}
            textContent={
              paymentType === 'send'
                ? t('constants.confirm')
                : t('constants.request')
            }
          />
        )}
      </>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {marginTop: 0, marginBottom: 0},
  scrollViewContainer: {
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 125,
    backgroundColor: 'red',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    // marginTop: 20,
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
  },
  giftAmountText: {
    textAlign: 'center',
  },

  giftContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  giftText: {
    marginRight: 5,
    includeFontPadding: false,
  },

  button: {
    width: 'auto',
    ...CENTER,
  },

  pill: {
    width: '90%',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 12,
    borderWidth: 3,
    alignSelf: 'center',
  },

  pillLogoContainer: {
    width: 40,
    height: 40,
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
  },
  giftLogo: {
    width: '100%',
    height: '100%',
    aspectRatio: 1,
    objectFit: 'fill',
  },
  pillText: {
    flexShrink: 1,
  },
});
