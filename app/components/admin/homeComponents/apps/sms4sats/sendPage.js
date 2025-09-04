import {
  FlatList,
  Keyboard,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import {ThemeText} from '../../../../../functions/CustomElements';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  SCREEN_DIMENSIONS,
  SIZES,
} from '../../../../../constants';
import {useCallback, useMemo, useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {sendCountryCodes} from './sendCountryCodes';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import {KEYBOARDTIMEOUT} from '../../../../../constants/styles';
import {AsYouType} from 'libphonenumber-js';
import CustomButton from '../../../../../functions/CustomElements/button';
import {encriptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import GetThemeColors from '../../../../../hooks/themeColors';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useKeysContext} from '../../../../../../context-store/keys';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import sendStorePayment from '../../../../../functions/apps/payments';
import {parse} from '@breeztech/react-native-breez-sdk-liquid';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';
import {useGlobalInsets} from '../../../../../../context-store/insetsProvider';
import {useActiveCustodyAccount} from '../../../../../../context-store/activeAccount';
import {useTranslation} from 'react-i18next';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import CountryFlag from 'react-native-country-flag';

export default function SMSMessagingSendPage({SMSprices}) {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {fiatStats} = useNodeContext();
  const {currentWalletMnemoinc} = useActiveCustodyAccount();
  const {sparkInformation} = useSparkWallet();
  const {masterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {decodedMessages, toggleGlobalAppDataInformation} = useGlobalAppData();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const {t} = useTranslation();
  const [sendingMessage, setSendingMessage] = useState(
    t('apps.sms4sats.sendPage.startingSendingMessage'),
  );
  const [focusedElement, setFocusedElement] = useState('');
  const phoneRef = useRef(null);
  const areaCodeRef = useRef(null);
  const messageRef = useRef(null);
  const navigate = useNavigation();
  const {textColor, backgroundColor} = GetThemeColors();

  const {bottomPadding} = useGlobalInsets();

  const selectedAreaCode = useMemo(() => {
    return sendCountryCodes.filter(
      item => item.country.toLowerCase() === areaCode.toLowerCase(),
    );
  }, [areaCode]);

  const changeFunction = (toPage, isClearing) => {
    if (isClearing) {
      setFocusedElement(prev => (prev === toPage || !toPage ? '' : prev));
      return;
    }

    setFocusedElement(toPage);
  };

  const flatListData = useMemo(() => {
    return sendCountryCodes
      .filter(item =>
        item.country.toLowerCase().startsWith(areaCode.toLowerCase()),
      )
      .sort((a, b) => a.country.localeCompare(b.country));
  }, [areaCode]);

  const flatListItem = useCallback(
    ({item}) => {
      return (
        <TouchableOpacity
          style={styles.countryItem}
          key={item.country}
          onPress={() => {
            setAreaCode(item.country);
            setFocusedElement('message');
            setTimeout(() => {
              messageRef.current?.focus();
            }, KEYBOARDTIMEOUT);
          }}>
          <CountryFlag
            style={{padding: 0, borderRadius: 8, marginBottom: 5}}
            isoCode={item.isoCode}
            size={50}
          />
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.countryText}
            content={item.country}
          />
        </TouchableOpacity>
      );
    },
    [messageRef],
  );

  const clearKeyboardFunc = useCallback(() => {
    if (isSending) return;
    Keyboard.dismiss();
    setFocusedElement('');
  }, [isSending]);

  return (
    <TouchableWithoutFeedback
      onPress={clearKeyboardFunc}
      style={styles.container}>
      {!isSending ? (
        <View
          style={[
            styles.container,
            {
              paddingBottom: focusedElement
                ? CONTENT_KEYBOARD_OFFSET
                : bottomPadding,
            },
          ]}>
          <TextInput
            style={styles.textInputHidden}
            onChangeText={e => setPhoneNumber(e)}
            ref={phoneRef}
            keyboardType="number-pad"
            maxLength={15}
            onFocus={() => changeFunction('phoneNumber')}
            onBlur={() => {
              changeFunction('', true);
            }}
          />
          <TextInput
            keyboardAppearance={theme ? 'dark' : 'light'}
            style={styles.textInputHidden}
            onChangeText={e => setAreaCode(e)}
            ref={areaCodeRef}
            keyboardType="ascii-capable"
            onFocus={() => {
              changeFunction('country');
            }}
            onBlur={() => changeFunction('', true)}
            value={areaCode}
          />

          <ThemeText
            styles={styles.inputDescription}
            content={t('apps.sms4sats.sendPage.phoneNumberInputDescription')}
          />

          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              changeFunction('phoneNumber');
            }}>
            <ThemeText
              styles={{
                ...styles.inputStyles,
                opacity: phoneNumber.length === 0 ? 0.5 : 1,
              }}
              content={
                phoneNumber.length > 15
                  ? phoneNumber.slice(0, 15) + '...'
                  : phoneNumber.length === 0
                  ? '(123) 456-7891'
                  : `${new AsYouType().input(
                      `${selectedAreaCode[0]?.cc || '+1'}${phoneNumber}`,
                    )}`
              }
            />
          </TouchableOpacity>

          <ThemeText
            styles={styles.inputDescription}
            content={t('apps.sms4sats.sendPage.phoneNumberCountryDescription')}
          />
          <TouchableOpacity
            onPress={() => {
              areaCodeRef.current.focus();
            }}
            style={styles.pushContentToBottom}>
            <ThemeText
              styles={{
                ...styles.inputStyles,
                opacity: areaCode.length === 0 ? 0.5 : 1,
              }}
              content={areaCode.length === 0 ? 'United States' : areaCode}
            />
          </TouchableOpacity>

          {(focusedElement === 'country' || !focusedElement) && (
            <FlatList
              numColumns={3}
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={3}
              style={styles.flatListOuterContianer}
              contentContainerStyle={styles.flatListContainer}
              columnWrapperStyle={styles.row}
              data={flatListData}
              renderItem={flatListItem}
              showsVerticalScrollIndicator={false}
            />
          )}

          {(!focusedElement || focusedElement === 'message') && (
            <>
              <CustomSearchInput
                onFocusFunction={() => {
                  changeFunction('message');
                }}
                onBlurFunction={() => {
                  changeFunction('', true);
                }}
                shouldDelayBlur={false}
                textInputRef={messageRef}
                setInputText={setMessage}
                inputText={message}
                placeholderText={t(
                  'apps.sms4sats.sendPage.messageInputDescription',
                )}
                maxLength={135}
                textInputMultiline={true}
                containerStyles={{
                  marginTop: 'auto',
                  maxHeight: 120,
                  width: INSET_WINDOW_WIDTH,
                  marginTop: 10,
                }}
              />
              {focusedElement !== 'message' && (
                <CustomButton
                  buttonStyles={{
                    width: 'auto',
                    marginTop: 10,
                    opacity:
                      phoneNumber.length === 0 ||
                      message.length === 0 ||
                      areaCode.length === 0
                        ? 0.5
                        : 1,
                    ...CENTER,
                  }}
                  textStyles={{
                    color: theme ? backgroundColor : COLORS.lightModeText,
                  }}
                  actionFunction={handleSubmit}
                  textContent={t('apps.sms4sats.sendPage.sendBTN')}
                />
              )}
            </>
          )}

          {focusedElement === 'phoneNumber' && (
            <CustomNumberKeyboard
              setInputValue={setPhoneNumber}
              frompage={'sendSMSPage'}
              usingForBalance={false}
              fiatStats={fiatStats}
              showDot={false}
            />
          )}
        </View>
      ) : (
        <FullLoadingScreen
          text={sendingMessage}
          textStyles={{textAlign: 'center'}}
        />
      )}
    </TouchableWithoutFeedback>
  );

  function handleSubmit() {
    if (
      phoneNumber.length === 0 ||
      message.length === 0 ||
      areaCode.length === 0
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('apps.sms4sats.sendPage.invalidInputError', {
          errorType:
            phoneNumber.length === 0
              ? 'phone number'
              : message.length === 0
              ? 'message'
              : 'area code',
        }),
      });
      return;
    } else if (selectedAreaCode.length === 0) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('apps.sms4sats.sendPage.invalidCountryError'),
      });
      return;
    }

    Keyboard.dismiss();
    setTimeout(
      () => {
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'confirmSMS',
          prices: SMSprices,
          phoneNumber: phoneNumber,
          areaCodeNum: selectedAreaCode[0].cc,
          sendTextMessage: sendTextMessage,
          message: message,
          sliderHight: 0.5,
        });
      },
      Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0,
    );

    return;
  }

  async function sendTextMessage(invoiceInformation) {
    setIsSending(true);
    const payload = {
      message: message,
      phone: `${selectedAreaCode[0].cc}${phoneNumber}`,
      ref: process.env.GPT_PAYOUT_LNURL,
    };

    let savedMessages = JSON.parse(JSON.stringify(decodedMessages));

    try {
      let orderInformation;

      if (invoiceInformation.payreq && invoiceInformation.orderId) {
        orderInformation = invoiceInformation;
      } else {
        const response = await fetch(
          `https://api2.sms4sats.com/createsendorder`,
          {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
          },
        );
        const data = await response.json();
        if (!data.payreq || !data.orderId) throw new Error(data.reason);
        const fee = await sparkPaymenWrapper({
          getFee: true,
          address: data.payreq,
          paymentType: 'lightning',
          amountSats: 1000,
          masterInfoObject,
          sparkInformation,
          userBalance: sparkInformation.balance,
          mnemonic: currentWalletMnemoinc,
        });
        if (!fee.didWork) throw new Error(fee.error);

        orderInformation = {...data, fee: fee.fee, supportFee: fee.supportFee};
      }

      savedMessages.sent.push({
        orderId: orderInformation.orderId,
        message: message,
        phone: `${selectedAreaCode[0].cc}${phoneNumber}`,
      });

      const parsedInput = await parse(orderInformation.payreq);
      const sendingAmountSat = parsedInput.invoice.amountMsat / 1000;
      setSendingMessage(t('apps.sms4sats.sendPage.payingMessage'));
      const paymentResponse = await sendStorePayment({
        invoice: orderInformation.payreq,
        masterInfoObject,
        sendingAmountSats: sendingAmountSat,
        paymentType: 'lightning',
        fee: orderInformation.fee + orderInformation.supportFee,
        userBalance: sparkInformation.balance,
        sparkInformation,
        description: t('apps.sms4sats.sendPage.paymentMemo'),
        currentWalletMnemoinc: currentWalletMnemoinc,
      });

      if (!paymentResponse.didWork) {
        setIsSending(false);
        navigate.navigate('ErrorScreen', {
          errorMessage: paymentResponse.reason,
        });
        return;
      }

      listenForConfirmation(
        orderInformation,
        savedMessages,
        paymentResponse.response,
      );
    } catch (err) {
      setSendingMessage(err.message);
      console.log(err);
    }
  }

  async function listenForConfirmation(data, savedMessages, paymentResponse) {
    saveMessagesToDB(savedMessages);

    let didSettleInvoice = false;
    let runCount = 0;

    while (!didSettleInvoice && runCount < 10) {
      try {
        runCount += 1;
        const resposne = await fetch(
          `https://api2.sms4sats.com/orderstatus?orderId=${data.orderId}`,
        );
        const smsData = await resposne.json();

        if (
          smsData.paid &&
          (smsData.smsStatus === 'delivered' || smsData.smsStatus === 'sent')
        ) {
          didSettleInvoice = true;
          navigate.reset({
            index: 0, // The top-level route index
            routes: [
              {
                name: 'HomeAdmin',
                params: {screen: 'Home'},
              },
              {
                name: 'ConfirmTxPage',
                params: {
                  for: 'paymentSucceed',
                  transaction: paymentResponse,
                },
              },
            ],
          });
        } else {
          setSendingMessage(
            t('apps.sms4sats.sendPage.runningTries', {
              runCount: runCount,
              maxTries: 10,
            }),
          );
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (err) {
        console.log(err);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (!didSettleInvoice)
      setSendingMessage(t('apps.sms4sats.sendPage.notAbleToSettleInvoice'));
  }

  async function saveMessagesToDB(messageObject) {
    const em = encriptMessage(
      contactsPrivateKey,
      publicKey,
      JSON.stringify(messageObject),
    );

    toggleGlobalAppDataInformation({messagesApp: em}, true);
  }
}

const styles = StyleSheet.create({
  container: {flex: 1},

  inputStyles: {
    width: '100%',
    fontSize: SIZES.large,
    marginTop: 10,
    textAlign: 'center',
  },
  areaCodeInput: {
    fontSize: SIZES.xLarge,
    marginTop: 10,
  },
  inputDescription: {
    textAlign: 'center',
    marginTop: 20,
  },
  pushContentToBottom: {
    marginBottom: 'auto',
  },
  button: {
    width: '100%',
    borderRadius: 8,
  },
  textInputHidden: {
    width: 0,
    height: 0,
    position: 'absolute',
    left: 1000,
    top: 1000,
  },
  flatListOuterContianer: {
    marginTop: 10,
  },
  flatListContainer: {
    width: '100%',
    paddingBottom: 20,
    gap: 15,
    alignSelf: 'center',
    paddingTop: 20,
  },
  row: {
    gap: 15,
  },
  countryItem: {
    flex: 1,
    maxWidth: SCREEN_DIMENSIONS.width * 0.3333 - 15,
    alignItems: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryText: {
    opacity: 0.8,
    fontSize: SIZES.small,
    textAlign: 'center',
  },
});
