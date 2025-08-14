import {StyleSheet, TouchableOpacity, View, ScrollView} from 'react-native';
import {CENTER, ICONS, SATSPERBITCOIN} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {useCallback, useMemo, useRef, useState} from 'react';
import {publishMessage} from '../../../../functions/messaging/publishMessage';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {getFiatRates} from '../../../../functions/SDK';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import customUUID from '../../../../functions/customUUID';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../context-store/appStatus';
import {useKeysContext} from '../../../../../context-store/keys';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import {useImageCache} from '../../../../../context-store/imageCache';
import ContactProfileImage from './internalComponents/profileImage';
import getReceiveAddressForContactPayment from './internalComponents/getReceiveAddressAndKindForPayment';
import {useServerTimeOnly} from '../../../../../context-store/serverTime';
import {useTranslation} from 'react-i18next';

export default function SendAndRequestPage(props) {
  const navigate = useNavigation();
  const {cache} = useImageCache();
  const {masterInfoObject} = useGlobalContextProvider();
  const {contactsPrivateKey} = useKeysContext();
  const {isConnectedToTheInternet} = useAppStatus();
  const {fiatStats} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();
  const {globalContactsInformation} = useGlobalContacts();
  const getServerTime = useServerTimeOnly();
  // const {ecashWalletInformation} = useGlobaleCash();
  // const eCashBalance = ecashWalletInformation.balance;
  const [amountValue, setAmountValue] = useState('');
  const [isAmountFocused, setIsAmountFocused] = useState(true);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination,
  );
  const {t} = useTranslation();
  const descriptionRef = useRef(null);
  const selectedContact = props.route.params.selectedContact;
  const paymentType = props.route.params.paymentType;
  const fromPage = props.route.params.fromPage;
  const isBTCdenominated =
    inputDenomination == 'hidden' || inputDenomination == 'sats';

  const convertedSendAmount = useMemo(
    () =>
      (isBTCdenominated
        ? Math.round(amountValue)
        : Math.round((SATSPERBITCOIN / fiatStats?.value) * amountValue)) || 0,
    [amountValue, fiatStats, isBTCdenominated],
  );

  const canSendPayment = useMemo(
    () => convertedSendAmount,
    // paymentType === 'request'
    //   ? convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
    //     convertedSendAmount
    //   : convertedSendAmount,
    [convertedSendAmount, minMaxLiquidSwapAmounts, paymentType],
  );
  useHandleBackPressNew();

  const handleSearch = useCallback(term => {
    setAmountValue(term);
  }, []);

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
      const fiatCurrencies = await getFiatRates();
      const sendingAmountMsat = convertedSendAmount * 1000;
      const address = selectedContact.receiveAddress;

      const contactMessage = descriptionValue;
      const myProfileMessage = !!descriptionValue
        ? descriptionValue
        : `Paying ${selectedContact.name || selectedContact.uniqueName}`;
      const payingContactMessage = !!descriptionValue
        ? descriptionValue
        : `${
            globalContactsInformation.myProfile.name ||
            globalContactsInformation.myProfile.uniqueName
          } paid you`;

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

      const currentTime = getServerTime();
      const UUID = customUUID();
      let sendObject = {};
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
              fiatCurrencies,
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
          fiatCurrencies,
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
  ]);

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={!isAmountFocused}
      useLocalPadding={true}
      useStandardWidth={true}>
      <TouchableOpacity onPress={navigate.goBack}>
        <ThemeImage
          darkModeIcon={ICONS.smallArrowLeft}
          lightModeIcon={ICONS.smallArrowLeft}
          lightsOutIcon={ICONS.arrow_small_left_white}
        />
      </TouchableOpacity>
      <View style={styles.globalContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContainer}>
          <View
            style={[
              styles.profileImage,
              {
                backgroundColor: backgroundOffset,
                marginBottom: 5,
              },
            ]}>
            <ContactProfileImage
              updated={cache[selectedContact.uuid]?.updated}
              uri={cache[selectedContact.uuid]?.localUri}
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>
          <ThemeText
            styles={styles.profileName}
            content={`${selectedContact.name || selectedContact.uniqueName}`}
          />
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
        </ScrollView>

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
          setInputText={setDescriptionValue}
          inputText={descriptionValue}
          textInputMultiline={true}
          textAlignVertical={'center'}
          maxLength={149}
          containerStyles={{
            width: '90%',
          }}
        />

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
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  globalContainer: {flex: 1},
  scrollViewContainer: {
    paddingBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 125,
    backgroundColor: 'red',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    marginTop: 20,
    overflow: 'hidden',
  },
  profileName: {
    ...CENTER,
    marginBottom: 20,
  },

  button: {
    width: 'auto',
    ...CENTER,
  },
});
