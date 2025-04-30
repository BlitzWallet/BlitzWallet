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
import {
  DUST_LIMIT_FOR_LBTC_CHAIN_PAYMENTS,
  LIGHTNINGAMOUNTBUFFER,
} from '../../../../constants/math';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {getFiatRates} from '../../../../functions/SDK';
import {useGlobaleCash} from '../../../../../context-store/eCash';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import customUUID from '../../../../functions/customUUID';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../context-store/appStatus';
import {useKeysContext} from '../../../../../context-store/keys';
import {
  calculateEcashFees,
  getProofsToUse,
} from '../../../../functions/eCash/wallet';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import formatBip21LiquidAddress from '../../../../functions/liquidWallet/formatBip21liquidAddress';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';
import {getSingleContact} from '../../../../../db';
import convertTextInputValue from '../../../../functions/textInputConvertValue';

export default function SendAndRequestPage(props) {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {contactsPrivateKey} = useKeysContext();
  const {isConnectedToTheInternet} = useAppStatus();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor, backgroundOffset} = GetThemeColors();
  const {globalContactsInformation} = useGlobalContacts();
  const {ecashWalletInformation} = useGlobaleCash();
  const eCashBalance = ecashWalletInformation.balance;
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
        : Math.round(
            (SATSPERBITCOIN / nodeInformation?.fiatStats?.value) * amountValue,
          )) || 0,
    [amountValue, nodeInformation, isBTCdenominated],
  );

  const boltzFee = useMemo(() => {
    return (
      minMaxLiquidSwapAmounts.reverseSwapStats?.fees?.minerFees?.claim +
      minMaxLiquidSwapAmounts.reverseSwapStats?.fees?.minerFees?.lockup +
      Math.round(convertedSendAmount * 0.0025)
    );
  }, [convertedSendAmount, minMaxLiquidSwapAmounts]);

  const lnFee = useMemo(() => {
    return convertedSendAmount * 0.005 + 4;
  }, [convertedSendAmount]);

  const canUseLiquid = useMemo(
    () =>
      selectedContact?.isLNURL
        ? Number(convertedSendAmount) >= minMaxLiquidSwapAmounts.min &&
          Number(convertedSendAmount) <= minMaxLiquidSwapAmounts.max &&
          liquidNodeInformation.userBalance >= Number(convertedSendAmount)
        : liquidNodeInformation.userBalance >= Number(convertedSendAmount) &&
          Number(convertedSendAmount) >= DUST_LIMIT_FOR_LBTC_CHAIN_PAYMENTS,
    [
      convertedSendAmount,
      selectedContact,
      liquidNodeInformation,
      minMaxLiquidSwapAmounts,
    ],
  );

  const canUseLightning = useMemo(
    () =>
      masterInfoObject.liquidWalletSettings.isLightningEnabled
        ? selectedContact?.isLNURL
          ? nodeInformation.userBalance >= Number(convertedSendAmount)
          : nodeInformation.userBalance >=
              Number(convertedSendAmount) + lnFee &&
            Number(convertedSendAmount) >= minMaxLiquidSwapAmounts.min &&
            Number(convertedSendAmount) <= minMaxLiquidSwapAmounts.max
        : false,
    [
      convertedSendAmount,
      boltzFee,
      minMaxLiquidSwapAmounts,
      nodeInformation,
      masterInfoObject,
      selectedContact,
      lnFee,
    ],
  );

  const usedEcashProofs = useMemo(() => {
    const proofsToUse = getProofsToUse(
      ecashWalletInformation.proofs,
      convertedSendAmount,
    );
    return proofsToUse
      ? proofsToUse?.proofsToUse
      : ecashWalletInformation.proofs;
  }, [convertedSendAmount, ecashWalletInformation]);

  const canUseEcash = useMemo(
    () =>
      masterInfoObject.enabledEcash
        ? selectedContact?.isLNURL
          ? eCashBalance >= Number(convertedSendAmount) + lnFee
          : eCashBalance >= Number(convertedSendAmount) + lnFee &&
            Number(convertedSendAmount) >= minMaxLiquidSwapAmounts.min &&
            Number(convertedSendAmount) <= minMaxLiquidSwapAmounts.max
        : false,
    [
      selectedContact,
      eCashBalance,
      convertedSendAmount,
      masterInfoObject,
      ecashWalletInformation,
      usedEcashProofs,
      lnFee,
    ],
  );

  const canSendToLNURL = useMemo(
    () =>
      !!selectedContact?.isLNURL &&
      (nodeInformation.userBalance >=
        Number(convertedSendAmount) + LIGHTNINGAMOUNTBUFFER ||
        canUseEcash ||
        (canUseLiquid &&
          Number(convertedSendAmount) >= minMaxLiquidSwapAmounts.min)) &&
      !!Number(convertedSendAmount),
    [
      selectedContact,
      nodeInformation,
      convertedSendAmount,
      LIGHTNINGAMOUNTBUFFER,
      canUseEcash,
      canUseLiquid,
      minMaxLiquidSwapAmounts,
    ],
  );

  console.log(
    canUseLiquid,
    canUseEcash,
    canUseLightning,
    canSendToLNURL,
    convertedSendAmount,
    minMaxLiquidSwapAmounts.min,
    'CAN USE LIQUID',
  );

  const canSendPayment = useMemo(
    () =>
      paymentType === 'request'
        ? convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
          convertedSendAmount
        : (canUseEcash || canUseLightning || canUseLiquid) &&
          convertedSendAmount,
    [
      convertedSendAmount,
      canUseEcash,
      canUseLightning,
      canUseLiquid,
      minMaxLiquidSwapAmounts,
      paymentType,
    ],
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
      if (selectedContact.isLNURL) {
        receiveAddress = address;
        // note do not need to set an amount for lnurl taken care of down below with entered payment information object
      } else {
        const [payingContact] = await getSingleContact(
          selectedContact.uniqueName,
        );
        console.log('Retrived selected contact', payingContact);
        if (!payingContact) {
          // If accessing database fails use legacy liquid address to not inturrupt payment experince
          receiveAddress = formatBip21LiquidAddress({
            address: address,
            amount: convertedSendAmount,
            message: `Paying ${
              selectedContact.name || selectedContact.uniqueName
            }`,
          });
        } else {
          let locallyChosenAddress = '';
          const addressList = payingContact?.offlineReceiveAddresses?.addresses;
          console.log('selected contacts address list:', addressList);

          if (addressList) {
            // Randomly select one of the stored addresses
            const randomNumber = Math.round(
              Math.random() * (addressList.length - 1),
            );
            locallyChosenAddress = addressList[randomNumber];
          } else {
            // If paying to legacy user use their stored liquid address
            locallyChosenAddress = selectedContact.receiveAddress;
          }
          console.log('selected address:', locallyChosenAddress);
          receiveAddress = formatBip21LiquidAddress({
            address: locallyChosenAddress,
            amount: convertedSendAmount,
            message: `Paying ${
              selectedContact.name || selectedContact.uniqueName
            }`,
          });
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
            <Image
              source={
                selectedContact.profileImage
                  ? {uri: selectedContact.profileImage}
                  : darkModeType && theme
                  ? ICONS.userWhite
                  : ICONS.userIcon
              }
              style={
                selectedContact.profileImage
                  ? {width: '100%', aspectRatio: 1}
                  : {width: '50%', height: '50%'}
              }
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
                  nodeInformation,
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
            nodeInformation={nodeInformation}
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
