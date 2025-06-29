import {StyleSheet, Text, View, TouchableOpacity, Platform} from 'react-native';
import {CENTER, SIZES, ICONS} from '../../constants';
import {useEffect, useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {copyToClipboard} from '../../functions';
import {useGlobalContextProvider} from '../../../context-store/context';
import {ButtonsContainer} from '../../components/admin/homeComponents/receiveBitcoin';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import {useGlobaleCash} from '../../../context-store/eCash';
import GetThemeColors from '../../hooks/themeColors';
import ThemeImage from '../../functions/CustomElements/themeImage';
import {initializeAddressProcess} from '../../functions/receiveBitcoin/addressGeneration';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import QrCodeWrapper from '../../functions/CustomElements/QrWrapper';
import {useNodeContext} from '../../../context-store/nodeContext';
import {useAppStatus} from '../../../context-store/appStatus';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import CustomButton from '../../functions/CustomElements/button';
import {crashlyticsLogReport} from '../../functions/crashlyticsLogs';
import {useGlobalContacts} from '../../../context-store/globalContacts';
import {useLiquidEvent} from '../../../context-store/liquidEventContext';

export default function ReceivePaymentHome(props) {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {globalContactsInformation} = useGlobalContacts();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {ecashWalletInformation} = useGlobaleCash();
  const {startLiquidEventListener} = useLiquidEvent();
  const currentMintURL = ecashWalletInformation.mintURL;
  const eCashBalance = ecashWalletInformation.balance;
  const initialSendAmount = props.route.params?.receiveAmount;
  const paymentDescription = props.route.params?.description;
  useHandleBackPressNew();
  const selectedRecieveOption =
    props.route.params?.selectedRecieveOption || 'Lightning';

  const [addressState, setAddressState] = useState({
    selectedRecieveOption: selectedRecieveOption,
    isReceivingSwap: false,
    generatedAddress: `${globalContactsInformation.myProfile.uniqueName}@blitz-wallet.com`,
    isGeneratingInvoice: false,
    minMaxSwapAmount: {
      min: 0,
      max: 0,
    },
    swapPegInfo: {},
    errorMessageText: {
      type: null,
      text: '',
    },
    hasGlobalError: false,
    fee: 0,
  });

  useEffect(() => {
    crashlyticsLogReport('Begining adddress initialization');
    if (
      !initialSendAmount &&
      selectedRecieveOption.toLowerCase() === 'lightning'
    )
      return;

    if (selectedRecieveOption.toLowerCase() === 'liquid') {
      startLiquidEventListener();
    }

    initializeAddressProcess({
      userBalanceDenomination: masterInfoObject.userBalanceDenomination,
      receivingAmount: initialSendAmount,
      description: paymentDescription,
      masterInfoObject,
      minMaxSwapAmounts: minMaxLiquidSwapAmounts,
      mintURL: currentMintURL,
      setAddressState: setAddressState,
      selectedRecieveOption: selectedRecieveOption,
      navigate,
      eCashBalance,
    });
  }, [initialSendAmount, paymentDescription, selectedRecieveOption]);

  useEffect(() => {
    if (selectedRecieveOption !== 'Bitcoin') return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        navigate.navigate('ErrorScreen', {
          errorMessage:
            'Currently, on-chain payment addresses are single-use only. Sending more than one payment to the same address will result in a loss of funds.',
        });
      });
    });
  }, [selectedRecieveOption]);
  return (
    <GlobalThemeView styles={{alignItems: 'center'}} useStandardWidth={true}>
      <TopBar navigate={navigate} />

      <ThemeText styles={{...styles.title}} content={selectedRecieveOption} />
      <QrCode navigate={navigate} addressState={addressState} />

      <ButtonsContainer
        generatingInvoiceQRCode={addressState.isGeneratingInvoice}
        generatedAddress={addressState.generatedAddress}
      />

      <View style={{marginBottom: 'auto'}}></View>

      <View
        style={{
          alignItems: 'center',
          // position: 'absolute',
          // [Platform.OS === 'ios' ? 'top' : 'bottom']:
          // Platform.OS === 'ios' ? '100%' : 0,
        }}>
        <ThemeText content={'Fee:'} />
        <FormattedSatText
          neverHideBalance={true}
          styles={{paddingBottom: 5}}
          balance={0}
        />
        {/* <Text
          style={[
            styles.title,
            {
              color: textColor,
              marginTop: 0,
              marginBottom: 0,
            },
          ]}>
          {selectedRecieveOption.toLowerCase() === 'bitcoin' &&
          addressState.errorMessageText.text
            ? `${
                addressState.minMaxSwapAmount.min > initialSendAmount
                  ? 'Minimum'
                  : 'Maximum'
              } receive amount:`
            : `Fee:`}
        </Text> */}
        {/* {addressState.isGeneratingInvoice ? (
          <ThemeText content={' '} />
        ) : (
          <FormattedSatText
            neverHideBalance={true}
            styles={{paddingBottom: 5}}
            balance={
              selectedRecieveOption.toLowerCase() === 'bitcoin' &&
              addressState.errorMessageText.text
                ? addressState.minMaxSwapAmount.min > initialSendAmount
                  ? addressState.minMaxSwapAmount.min
                  : addressState.minMaxSwapAmount.max
                : addressState.fee
            }
          />
        )} */}
      </View>
    </GlobalThemeView>
  );
}

function QrCode(props) {
  const {addressState, navigate} = props;
  const {backgroundOffset} = GetThemeColors();
  if (addressState.isGeneratingInvoice) {
    return (
      <View
        style={{
          ...styles.qrCodeContainer,
          backgroundColor: backgroundOffset,
        }}>
        <FullLoadingScreen text={'Generating Invoice'} />
      </View>
    );
  }
  if (!addressState.generatedAddress) {
    return (
      <View
        style={{
          ...styles.qrCodeContainer,
          backgroundColor: backgroundOffset,
        }}>
        <ThemeText
          styles={styles.errorText}
          content={
            addressState.errorMessageText.text || 'Unable to generate address'
          }
        />
        {addressState.errorMessageText.showButton && (
          <CustomButton
            buttonStyles={{width: '90%', marginTop: 20}}
            textContent={'Open transfer page'}
            actionFunction={() => {
              navigate.reset({
                routes: [
                  {
                    name: 'HomeAdmin',
                    params: {screen: 'Home'},
                  },
                  {
                    name: 'SettingsHome',
                  },
                  {
                    name: 'SettingsContentHome',
                    params: {
                      for: 'Balance Info',
                    },
                  },
                ],
              });
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.qrCodeContainer}>
      <TouchableOpacity
        onPress={() => {
          copyToClipboard(addressState.generatedAddress, navigate);
        }}
        style={[
          styles.qrCodeContainer,
          {
            backgroundColor: backgroundOffset,
            paddingBottom: !!addressState.errorMessageText.text ? 10 : 0,
          },
        ]}>
        <QrCodeWrapper
          outerContainerStyle={{backgroundColor: 'transparent'}}
          QRData={addressState.generatedAddress}
        />

        {addressState.errorMessageText.text && (
          <ThemeText
            styles={{textAlign: 'center', width: 275, marginTop: 10}}
            content={addressState.errorMessageText.text}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

function TopBar(props) {
  return (
    <TouchableOpacity
      style={{marginRight: 'auto'}}
      activeOpacity={0.6}
      onPress={props.navigate.goBack}>
      <ThemeImage
        darkModeIcon={ICONS.smallArrowLeft}
        lightModeIcon={ICONS.smallArrowLeft}
        lightsOutIcon={ICONS.arrow_small_left_white}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 10,
    marginTop: 'auto',
  },
  qrCodeContainer: {
    width: 300,
    height: 'auto',
    minHeight: 300,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorText: {
    width: '90%',
    fontSize: SIZES.medium,
    textAlign: 'center',
    marginTop: 20,
  },

  secondaryButton: {
    width: 'auto',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    ...CENTER,
  },
});
