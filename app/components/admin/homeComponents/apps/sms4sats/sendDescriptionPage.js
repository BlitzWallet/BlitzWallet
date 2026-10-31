import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
} from '../../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useWebView } from '../../../../../../context-store/webViewContext';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
import sendStorePayment from '../../../../../functions/apps/payments';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { keyboardNavigate } from '../../../../../functions/customNavigation';
import { formatSmsPhoneNumber, SMS_SEND_MAX_LENGTH } from './utils';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../functions/CustomElements/redesign/PageHeader';
import UserInput from '../../../../../functions/CustomElements/redesign/UserInput';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import useContentWidth from '../../../../../functions/CustomElements/redesign/useContentWidth';

export default function SMSMessagingSendDescriptionPage(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation } = useSparkWallet();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sendWebViewRequest } = useWebView();
  const { fiatStats } = useNodeContext();
  const { decodedMessages, toggleGlobalAppDataInformation } =
    useGlobalAppData();
  const contentWidth = useContentWidth();
  const [description, setDescription] = useState(
    props.route?.params?.description || '',
  );
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(
    t('apps.sms4sats.sendPage.startingSendingMessage'),
  );
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [sentTotal, setSentTotal] = useState(0);

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

  // Called by the confirm sheet with the order it created and priced.
  const sendTextMessage = useCallback(
    async invoiceInformation => {
      setIsSending(true);
      const savedMessages = JSON.parse(
        JSON.stringify(decodedMessages || { received: [], sent: [] }),
      );

      if (!Array.isArray(savedMessages.sent)) savedMessages.sent = [];
      if (!Array.isArray(savedMessages.received)) savedMessages.received = [];

      try {
        savedMessages.sent.push({
          orderId: invoiceInformation.orderId,
          message: description.trim(),
          phone: normalizedPhoneNumber,
          createdAt: Date.now(),
        });

        setSendingMessage(t('apps.sms4sats.sendPage.payingMessage'));
        const fee = invoiceInformation.fee + invoiceInformation.supportFee;
        const paymentResponse = await sendStorePayment({
          invoice: invoiceInformation.payreq,
          masterInfoObject,
          sendingAmountSats: invoiceInformation.amountSat,
          paymentType: 'lightning',
          fee,
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
        setSentTotal(invoiceInformation.amountSat + fee);
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
        normalizedPhoneNumber,
        sendTextMessage,
        message: description.trim(),
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
    const done = () =>
      navigate.popTo('AppStorePageIndex', { page: 'sms4sats' });
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar onBack={done} />
          <View style={styles.confirm}>
            <Disc icon={'Check'} tone="primary" size={72} iconSize={34} />
            <ThemeText
              styles={styles.confirmTitle}
              content={t('apps.sms4sats.sendPage.confirmedMessage')}
            />
            <ThemeText
              styles={styles.confirmSub}
              variant={'hint'}
              content={t('apps.sms4sats.sendPage.confirmedSubtitle', {
                phone: formatSmsPhoneNumber(normalizedPhoneNumber),
                amount: displayCorrectDenomination({
                  amount: sentTotal,
                  masterInfoObject: {
                    ...masterInfoObject,
                    userBalanceDenomination: 'sats',
                  },
                  fiatStats,
                }),
              })}
            />
          </View>
          <CustomButton
            actionFunction={done}
            textContent={t('constants.done')}
            size={'regular'}
          />
        </View>
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
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('constants.send')} shouldDismissKeyboard={true} />
        <CustomScrollView showsVerticalScrollIndicator={false}>
          <PageHeader
            title={t('apps.sms4sats.sendPage.descriptionStepTitle')}
            sub={t('apps.sms4sats.sendPage.descriptionStepSubtitle', {
              phone: formatSmsPhoneNumber(normalizedPhoneNumber),
            })}
          />
          <UserInput
            value={description}
            onChangeText={setDescription}
            placeholder={t(
              'apps.sms4sats.sendPage.descriptionInputPlaceholder',
            )}
            maxLength={SMS_SEND_MAX_LENGTH}
            onFocus={() => setIsKeyboardActive(true)}
            onBlur={() => setIsKeyboardActive(false)}
            focusRing
            showTextCount
            multiline
          />
        </CustomScrollView>
        <CustomButton
          disabled={!description.trim()}
          buttonStyles={styles.button}
          actionFunction={handleContinue}
          textContent={t('constants.continue')}
          size={'regular'}
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  confirm: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontFamily: FONT.Title_Medium,
    fontSize: 20,
    lineHeight: 26,
    marginTop: 20,
    textAlign: 'center',
    includeFontPadding: false,
  },
  confirmSub: {
    marginTop: 6,
    textAlign: 'center',
  },
  button: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
