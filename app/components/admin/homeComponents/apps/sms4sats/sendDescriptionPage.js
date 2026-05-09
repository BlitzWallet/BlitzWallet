import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../../functions/CustomElements/button';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useWebView } from '../../../../../../context-store/webViewContext';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
import sendStorePayment from '../../../../../functions/apps/payments';
import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';
import { decode } from 'bolt11';
import { keyboardNavigate } from '../../../../../functions/customNavigation';
import { SMS_SEND_MAX_LENGTH } from './utils';
import { GlobalThemeView } from '../../../../../functions/CustomElements';
import LottieView from 'lottie-react-native';
import { updateConfirmAnimation } from '../../../../../functions/lottieViewColorTransformer';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';

const confirmTxAnimation = require('../../../../../assets/confirmTxAnimation.json');

export default function SMSMessagingSendDescriptionPage(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation } = useSparkWallet();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sendWebViewRequest } = useWebView();
  const { screenDimensions } = useAppStatus();
  const { decodedMessages, toggleGlobalAppDataInformation } =
    useGlobalAppData();
  const [description, setDescription] = useState(
    props.route?.params?.description || '',
  );
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(
    t('apps.sms4sats.sendPage.startingSendingMessage'),
  );
  const [isConfirmed, setIsConfirmed] = useState(false);
  const animationRef = useRef(null);

  const selectedCountry = props.route?.params?.selectedCountry;
  const phoneNumber = props.route?.params?.phoneNumber || '';
  const normalizedPhoneNumber =
    props.route?.params?.normalizedPhoneNumber || '';

  const saveMessagesToDB = useCallback(
    async messageObject => {
      const encryptedMessages = encriptMessage(
        contactsPrivateKey,
        publicKey,
        JSON.stringify(messageObject),
      );

      await toggleGlobalAppDataInformation(
        { messagesApp: encryptedMessages },
        true,
      );
    },
    [contactsPrivateKey, publicKey, toggleGlobalAppDataInformation],
  );

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  useEffect(() => {
    if (isConfirmed) {
      animationRef.current?.play();
    }
  }, [isConfirmed]);

  const sendTextMessage = useCallback(
    async invoiceInformation => {
      setIsSending(true);
      const payload = {
        message: description.trim(),
        phone: normalizedPhoneNumber,
        ref: process.env.GPT_PAYOUT_LNURL,
      };

      const savedMessages = JSON.parse(
        JSON.stringify(decodedMessages || { received: [], sent: [] }),
      );

      if (!Array.isArray(savedMessages.sent)) savedMessages.sent = [];
      if (!Array.isArray(savedMessages.received)) savedMessages.received = [];

      try {
        let orderInformation = invoiceInformation;

        if (!invoiceInformation?.payreq || !invoiceInformation?.orderId) {
          const response = await fetch(
            'https://api2.sms4sats.com/createsendorder',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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
            sendWebViewRequest,
          });

          if (!fee.didWork) throw new Error(t('errormessages.paymentFeeError'));

          orderInformation = {
            ...data,
            fee: fee.fee,
            supportFee: fee.supportFee,
          };
        }

        savedMessages.sent.push({
          orderId: orderInformation.orderId,
          message: description.trim(),
          phone: normalizedPhoneNumber,
          createdAt: Date.now(),
        });

        const invoiceDetails = decode(orderInformation.payreq);

        setSendingMessage(t('apps.sms4sats.sendPage.payingMessage'));
        const paymentResponse = await sendStorePayment({
          invoice: orderInformation.payreq,
          masterInfoObject,
          sendingAmountSats: invoiceDetails.satoshis,
          paymentType: 'lightning',
          fee: orderInformation.fee + orderInformation.supportFee,
          userBalance: sparkInformation.balance,
          sparkInformation,
          description: t('apps.sms4sats.sendPage.paymentMemo'),
          currentWalletMnemoinc,
          sendWebViewRequest,
        });

        if (!paymentResponse.didWork) {
          throw new Error(paymentResponse.reason);
        }

        await saveMessagesToDB(savedMessages);
        setIsSending(false);
        setIsConfirmed(true);
      } catch (error) {
        console.log(error);
        setIsSending(false);
        navigate.navigate('ErrorScreen', {
          errorMessage: error.message,
        });
      }
    },
    [
      currentWalletMnemoinc,
      decodedMessages,
      description,
      masterInfoObject,
      navigate,
      normalizedPhoneNumber,
      sendWebViewRequest,
      sparkInformation,
      t,
      saveMessagesToDB,
    ],
  );

  const handleBackPress = useCallback(() => {
    if (isConfirmed) {
      navigate.popTo('AppStorePageIndex', { page: 'sms4sats' });
      return true;
    } else return false;
  }, [isConfirmed]);

  useHandleBackPressNew(handleBackPress);

  const handleContinue = () => {
    if (!description.trim()) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('apps.sms4sats.sendPage.invalidMessageError'),
      });
      return;
    }

    keyboardNavigate(() => {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'confirmSMS',
        phoneNumber,
        normalizedPhoneNumber,
        areaCodeNum: selectedCountry?.cc,
        sendTextMessage,
        message: description.trim(),
        sliderHight: 0.5,
      });
    });
  };

  if (isSending) {
    return (
      <FullLoadingScreen
        text={sendingMessage}
        textStyles={{ textAlign: 'center' }}
      />
    );
  }

  if (isConfirmed) {
    return (
      <GlobalThemeView
        useStandardWidth={true}
        styles={styles.confirmedContainer}
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
          styles={{
            fontSize: SIZES.large,
            marginBottom: 10,
            textAlign: 'center',
          }}
          content={t('apps.sms4sats.sendPage.confirmedMessage')}
        />
        <CustomButton
          buttonStyles={{
            width: INSET_WINDOW_WIDTH,
            ...CENTER,
            marginTop: 'auto',
            paddingHorizontal: 15,
          }}
          actionFunction={() => {
            navigate.popTo('AppStorePageIndex', { page: 'sms4sats' });
          }}
          textContent={t('constants.continue')}
        />
      </GlobalThemeView>
    );
  }

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        label={t('constants.send')}
        shouldDismissKeyboard={true}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <ThemeText
            styles={styles.title}
            content={t('apps.sms4sats.sendPage.descriptionStepTitle')}
          />
          <ThemeText
            styles={styles.subtitle}
            content={t('apps.sms4sats.sendPage.descriptionStepSubtitle')}
          />
          <CustomSearchInput
            inputText={description}
            setInputText={setDescription}
            placeholderText={t(
              'apps.sms4sats.sendPage.descriptionInputPlaceholder',
            )}
            textInputMultiline={true}
            maxLength={SMS_SEND_MAX_LENGTH}
            onFocusFunction={() => setIsKeyboardActive(true)}
            onBlurFunction={() => setIsKeyboardActive(false)}
            textInputStyles={styles.textArea}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>
      <CustomButton
        buttonStyles={[
          styles.button,
          { opacity: !description.trim() ? 0.5 : 1 },
        ]}
        actionFunction={handleContinue}
        textContent={t('constants.continue')}
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },
  textArea: {
    minHeight: 120,
  },
  button: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
  confirmedContainer: {
    flex: 1,
    alignItems: 'center',
  },
});
