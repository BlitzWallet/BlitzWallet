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
  FONT,
  SIZES,
} from '../../../../../constants';
import {useMemo, useRef, useState} from 'react';
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
import useAppInsets from '../../../../../hooks/useAppInsets';

export default function SMSMessagingSendPage({SMSprices}) {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {fiatStats} = useNodeContext();
  const {sparkInformation} = useSparkWallet();
  const {masterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {decodedMessages, toggleGlobalAppDataInformation} = useGlobalAppData();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendingMessage, setSendingMessage] = useState('Creating send order');
  const [focusedElement, setFocusedElement] = useState('');
  const phoneRef = useRef(null);
  const areaCodeRef = useRef(null);
  const messageRef = useRef(null);
  const navigate = useNavigation();
  const {textColor, backgroundColor} = GetThemeColors();

  const {bottomPadding} = useAppInsets();

  const selectedAreaCode = useMemo(() => {
    return sendCountryCodes.filter(
      item => item.country.toLowerCase() === areaCode.toLowerCase(),
    );
  }, [areaCode]);

  const changeFunction = (toPage, isClearing) => {
    if (isClearing) {
      setFocusedElement(prev => (prev === toPage ? '' : prev));
      return;
    }

    setFocusedElement(toPage);
  };

  return (
    <View style={{flex: 1}}>
      {!isSending ? (
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            setFocusedElement('');
          }}>
          <View
            style={{
              ...styles.sendPage,
              paddingBottom: focusedElement
                ? CONTENT_KEYBOARD_OFFSET
                : bottomPadding,
            }}>
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
              styles={{...CENTER, marginTop: 20}}
              content={'Enter phone number'}
            />

            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                changeFunction('phoneNumber');
              }}>
              <ThemeText
                styles={{
                  ...styles.phoneNumberInput,
                  textAlign: 'center',
                  opacity: phoneNumber.length === 0 ? 0.5 : 1,
                  color: textColor,
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
              styles={{...CENTER, marginTop: 20}}
              content={'Phone number country'}
            />
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginBottom: 'auto',
              }}
              onPress={() => {
                areaCodeRef.current.focus();
              }}>
              <ThemeText
                styles={{
                  ...styles.areaCodeInput,
                  textAlign: 'center',
                  opacity: areaCode.length === 0 ? 0.5 : 1,
                }}
                content={areaCode.length === 0 ? 'United States' : areaCode}
              />
            </TouchableOpacity>

            {(focusedElement === 'country' || !focusedElement) && (
              <FlatList
                contentContainerStyle={{paddingVertical: 10}}
                data={sendCountryCodes
                  .filter(item =>
                    item.country
                      .toLowerCase()
                      .startsWith(areaCode.toLowerCase()),
                  )
                  .sort((a, b) => a.country.localeCompare(b.country))}
                renderItem={({item}) => {
                  return (
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        marginVertical: 15,
                      }}
                      key={item.country}
                      onPress={() => {
                        setAreaCode(item.country);
                        setFocusedElement('message');
                        setTimeout(() => {
                          messageRef.current?.focus();
                        }, KEYBOARDTIMEOUT);
                      }}>
                      <ThemeText content={item.country} />
                    </TouchableOpacity>
                  );
                }}
                showsVerticalScrollIndicator={false}
                maxToRenderPerBatch={10}
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
                  placeholderText={'Message'}
                  maxLength={135}
                  textInputMultiline={true}
                  containerStyles={{
                    marginTop: 'auto',
                    maxHeight: 120,
                  }}
                />
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
                  textContent={'Send message'}
                />
              </>
            )}

            {focusedElement === 'phoneNumber' && (
              <CustomNumberKeyboard
                setInputValue={setPhoneNumber}
                frompage={'sendSMSPage'}
                usingForBalance={false}
                fiatStats={fiatStats}
              />
            )}
          </View>
        </TouchableWithoutFeedback>
      ) : (
        <FullLoadingScreen
          text={sendingMessage}
          textStyles={{textAlign: 'center'}}
        />
      )}
    </View>
  );

  function handleSubmit() {
    if (
      phoneNumber.length === 0 ||
      message.length === 0 ||
      areaCode.length === 0
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: `Must have a ${
          phoneNumber.length === 0
            ? 'phone number'
            : message.length === 0
            ? 'message'
            : 'area code'
        }`,
      });
      return;
    } else if (selectedAreaCode.length === 0) {
      navigate.navigate('ErrorScreen', {
        errorMessage: `Not a valid country`,
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
      setSendingMessage('Paying...');
      const paymentResponse = await sendStorePayment({
        invoice: orderInformation.payreq,
        masterInfoObject,
        sendingAmountSats: sendingAmountSat,
        paymentType: 'lightning',
        fee: orderInformation.fee + orderInformation.supportFee,
        userBalance: sparkInformation.balance,
        sparkInformation,
      });

      if (!paymentResponse.didWork) {
        setIsSending(false);
        navigate.navigate('ErrorScreen', {
          errorMessage: paymentResponse.reason || 'Error paying invoice.',
        });
        return;
      }

      listenForConfirmation(
        orderInformation,
        savedMessages,
        paymentResponse.response,
        paymentResponse.formattingType,
      );
    } catch (err) {
      setSendingMessage(err.message);
      console.log(err);
    }
  }

  async function listenForConfirmation(
    data,
    savedMessages,
    paymentResponse,
    formmatingType,
  ) {
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
                  information: paymentResponse,
                  formattingType: formmatingType,
                },
              },
            ],
          });
        } else {
          setSendingMessage(`Running ${runCount} of 10 tries`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (err) {
        console.log(err);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (!didSettleInvoice) setSendingMessage('Not able to settle invoice.');
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
  sendPage: {
    flex: 1,
  },

  phoneNumberInput: {
    width: '95%',
    fontSize: SIZES.xLarge,
    fontFamily: FONT.Title_Regular,
    ...CENTER,
    marginTop: 10,
  },
  areaCodeInput: {
    fontSize: SIZES.xLarge,
    marginTop: 10,
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
});
