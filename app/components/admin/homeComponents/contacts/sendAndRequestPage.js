import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
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
// import {
//   DUST_LIMIT_FOR_LBTC_CHAIN_PAYMENTS,
//   LIGHTNINGAMOUNTBUFFER,
// } from '../../../../constants/math';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {getFiatRates} from '../../../../functions/SDK';
// import {useGlobaleCash} from '../../../../../context-store/eCash';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import customUUID from '../../../../functions/customUUID';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../context-store/appStatus';
import {useKeysContext} from '../../../../../context-store/keys';
// import {
//   calculateEcashFees,
//   getProofsToUse,
// } from '../../../../functions/eCash/wallet';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import formatBip21LiquidAddress from '../../../../functions/liquidWallet/formatBip21liquidAddress';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';
import {getDataFromCollection} from '../../../../../db';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import {formatBip21SparkAddress} from '../../../../functions/spark/handleBip21SparkAddress';
import {useImageCache} from '../../../../../context-store/imageCache';
import ContactProfileImage from './internalComponents/profileImage';

export default function SendAndRequestPage(props) {
  const navigate = useNavigation();
  const {cache} = useImageCache();
  const {masterInfoObject} = useGlobalContextProvider();
  const {contactsPrivateKey} = useKeysContext();
  const {isConnectedToTheInternet} = useAppStatus();
  const {fiatStats} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor, backgroundOffset} = GetThemeColors();
  const {globalContactsInformation} = useGlobalContacts();
  // const {ecashWalletInformation} = useGlobaleCash();
  // const eCashBalance = ecashWalletInformation.balance;
  const [amountValue, setAmountValue] = useState('');
  const [isAmountFocused, setIsAmountFocused] = useState(true);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination,
  );
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
    () =>
      paymentType === 'request'
        ? convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
          convertedSendAmount
        : convertedSendAmount,
    [convertedSendAmount, minMaxLiquidSwapAmounts, paymentType],
  );
  useHandleBackPressNew();

  const handleSearch = useCallback(term => {
    setAmountValue(term);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Please reconnect to the internet to use this feature',
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
      let receiveAddress;
      let retrivedContact;
      if (selectedContact.isLNURL) {
        receiveAddress = address;
        // note do not need to set an amount for lnurl taken care of down below with entered payment information object
      } else {
        retrivedContact = await getDataFromCollection(
          'blitzWalletUsers',
          selectedContact.uuid,
        );
        console.log('Retrived selected contact', retrivedContact);
        if (!retrivedContact) {
          navigate.navigate('ErrorScreen', {
            errorMessage: 'Error retrieving contact information',
          });
          return;
        } else {
          if (retrivedContact?.contacts?.myProfile?.sparkAddress) {
            receiveAddress = formatBip21SparkAddress({
              address: retrivedContact?.contacts?.myProfile?.sparkAddress,
              amount: convertedSendAmount,
              message: `Paying ${
                selectedContact.name || selectedContact.uniqueName
              }`,
            });
          } else {
            navigate.navigate('ErrorScreen', {
              errorMessage:
                'Contact has not updated thier wallet yet. Please ask them to update their wallet to pay them.',
            });
            return;
          }
        }
      }

      const UUID = customUUID();
      let sendObject = {};
      if (paymentType === 'send') {
        sendObject['amountMsat'] = sendingAmountMsat;
        sendObject['description'] = descriptionValue;
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
            description: descriptionValue,
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
        });
        navigate.goBack();
      }
    } catch (err) {
      console.log(err, 'publishing message error');
      navigate.navigate('ErrorScreen', {
        errorMessage: selectedContact.isLNURL
          ? 'Error generating invoice. Make sure this is a valid LNURL address.'
          : 'Not able to create invoice',
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

      <View
        style={{
          flex: 1,
        }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 20,
          }}>
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
          placeholderText={"What's this for?"}
          setInputText={setDescriptionValue}
          inputText={descriptionValue}
          textInputMultiline={true}
          textAlignVertical={'center'}
          maxLength={150}
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
            textContent={paymentType === 'send' ? 'Confirm' : 'Request'}
          />
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
