import {StyleSheet, Text, View, TouchableOpacity} from 'react-native';
import {CENTER, SIZES, ICONS} from '../../constants';
import {useEffect, useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {copyToClipboard} from '../../functions';
import {useGlobalContextProvider} from '../../../context-store/context';
import {ButtonsContainer} from '../../components/admin/homeComponents/receiveBitcoin';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import handleBackPress from '../../hooks/handleBackPress';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import {useGlobaleCash} from '../../../context-store/eCash';
import GetThemeColors from '../../hooks/themeColors';
import ThemeImage from '../../functions/CustomElements/themeImage';
import {initializeAddressProcess} from '../../functions/receiveBitcoin/addressGeneration';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import QrCodeWrapper from '../../functions/CustomElements/QrWrapper';
import {useNodeContext} from '../../../context-store/nodeContext';
import {useAppStatus} from '../../../context-store/appStatus';

export default function ReceivePaymentHome(props) {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {ecashWalletInformation} = useGlobaleCash();
  const currentMintURL = ecashWalletInformation.mintURL;
  const {textColor} = GetThemeColors();
  const ecashRef = useRef(null);
  const initialSendAmount = props.route.params?.receiveAmount;
  const paymentDescription = props.route.params?.description;

  function handleBackPressFunction() {
    navigate.goBack();
    return true;
  }
  useEffect(() => {
    handleBackPress(handleBackPressFunction);
  }, []);

  const [addressState, setAddressState] = useState({
    selectedRecieveOption: 'lightning',
    isReceivingSwap: false,
    generatedAddress: '',
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

  const receiveOption = addressState.selectedRecieveOption;

  useEffect(() => {
    initializeAddressProcess({
      nodeInformation,
      userBalanceDenomination: masterInfoObject.userBalanceDenomination,
      receivingAmount: initialSendAmount,
      description: paymentDescription,
      masterInfoObject,
      minMaxSwapAmounts: minMaxLiquidSwapAmounts,
      mintURL: currentMintURL,
      ecashRef,
      setAddressState: setAddressState,
      selectedRecieveOption: addressState.selectedRecieveOption,
      navigate,
    });
  }, [initialSendAmount, paymentDescription, receiveOption]);
  return (
    <GlobalThemeView styles={{alignItems: 'center'}} useStandardWidth={true}>
      <TopBar navigate={navigate} />

      <ThemeText
        styles={{...styles.title}}
        content={addressState.selectedRecieveOption}
      />
      <QrCode navigate={navigate} addressState={addressState} />

      <ButtonsContainer
        generatingInvoiceQRCode={addressState.isGeneratingInvoice}
        generatedAddress={addressState.generatedAddress}
        setSelectedRecieveOption={setAddressState}
      />

      <View style={{marginBottom: 'auto'}}></View>

      <View style={{position: 'absolute', bottom: 0, alignItems: 'center'}}>
        <Text
          style={[
            styles.title,
            {
              color: textColor,
              marginTop: 0,
              marginBottom: 0,
            },
          ]}>
          {addressState.selectedRecieveOption.toLowerCase() === 'bitcoin' &&
          addressState.errorMessageText.text
            ? `${
                addressState.minMaxSwapAmount.min > initialSendAmount
                  ? 'Minimum'
                  : 'Maximum'
              } receive amount:`
            : `Fee:`}
        </Text>
        {addressState.isGeneratingInvoice ? (
          <ThemeText content={' '} />
        ) : (
          <FormattedSatText
            neverHideBalance={true}
            styles={{includeFontPadding: false}}
            balance={
              addressState.selectedRecieveOption.toLowerCase() === 'bitcoin' &&
              addressState.errorMessageText.text
                ? addressState.minMaxSwapAmount.min > initialSendAmount
                  ? addressState.minMaxSwapAmount.min
                  : addressState.minMaxSwapAmount.max
                : addressState.fee
            }
          />
        )}
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
      onPress={() => {
        props.navigate.reset({
          index: 0,
          routes: [
            {
              name: 'HomeAdmin',
              params: {
                screen: 'Home',
              },
            },
          ],
        });
      }}>
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
