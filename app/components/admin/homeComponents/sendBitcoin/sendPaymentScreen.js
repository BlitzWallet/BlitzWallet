import {StyleSheet, View, TouchableOpacity, ScrollView} from 'react-native';
import {
  ICONS,
  LIQUID_NON_BITCOIN_DRAIN_LIMIT,
  QUICK_PAY_STORAGE_KEY,
  SATSPERBITCOIN,
} from '../../../../constants';
import {useEffect, useMemo, useState} from 'react';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {CustomKeyboardAvoidingView} from '../../../../functions/CustomElements';
import SendTransactionFeeInfo from './components/feeInfo';
import decodeSendAddress from './functions/decodeSendAdress';
import {useNavigation} from '@react-navigation/native';
import {
  getLNAddressForLiquidPayment,
  sendBitcoinPayment,
  sendBolt12Offer_sendPaymentScreen,
  sendLightningPayment_sendPaymentScreen,
  sendLiquidPayment_sendPaymentScreen,
  sendPaymentUsingEcash,
  sendToLNFromLiquid_sendPaymentScreen,
  sendToLiquidFromLightning_sendPaymentScreen,
} from './functions/payments';
import {useWebView} from '../../../../../context-store/webViewContext';
import {
  DUST_LIMIT_FOR_LBTC_CHAIN_PAYMENTS,
  LIGHTNINGAMOUNTBUFFER,
} from '../../../../constants/math';
import {useGlobaleCash} from '../../../../../context-store/eCash';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {calculateBoltzFeeNew} from '../../../../functions/boltz/boltzFeeNew';

import NavbarBalance from './components/navBarBalance';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import AcceptButtonSendPage from './components/acceptButton';
import NumberInputSendPage from './components/numberInput';
import usablePaymentNetwork from './functions/usablePaymentNetworks';
import SendMaxComponent from './components/sendMaxComponent';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../context-store/appStatus';
import hasAlredyPaidInvoice from './functions/hasPaid';
import {
  calculateEcashFees,
  getProofsToUse,
} from '../../../../functions/eCash/wallet';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import {keyboardGoBack} from '../../../../functions/customNavigation';
import ErrorWithPayment from './components/errorScreen';
import SwipeButtonNew from '../../../../functions/CustomElements/sliderButton';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';
import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';

export default function SendPaymentScreen(props) {
  console.log('CONFIRM SEND PAYMENT SCREEN');
  // FIX MIN AND MAX SEND AMOUNTS HERE.
  const navigate = useNavigation();
  const {
    btcAdress,
    fromPage,
    publishMessageFunc,
    comingFromAccept,
    enteredPaymentInfo,
    errorMessage,
  } = props.route.params;

  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {ecashWalletInformation} = useGlobaleCash();
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();
  const {
    webViewRef,
    //  setWebViewArgs
  } = useWebView();

  const [isAmountFocused, setIsAmountFocused] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState({});
  const [isSendingPayment, setIsSendingPayment] = useState(false);
  const [paymentDescription, setPaymentDescription] = useState('');
  const [loadingMessage, setLoadingMessage] = useState(
    'Getting invoice information',
  );

  const eCashBalance = ecashWalletInformation.balance;
  const sendingAmount = paymentInfo?.sendAmount || 0;
  const isBTCdenominated =
    masterInfoObject.userBalanceDenomination === 'hidden' ||
    masterInfoObject.userBalanceDenomination === 'sats';
  const canEditPaymentAmount = paymentInfo?.canEditPayment;
  const convertedSendAmount = isBTCdenominated
    ? Math.round(Number(sendingAmount))
    : Math.round(
        (SATSPERBITCOIN / nodeInformation.fiatStats?.value) *
          Number(sendingAmount),
      );
  const swapFee = calculateBoltzFeeNew(
    Number(convertedSendAmount),
    paymentInfo.type === 'liquid' ? 'ln-liquid' : 'liquid-ln',
    minMaxLiquidSwapAmounts[
      paymentInfo.type === 'liquid' ? 'reverseSwapStats' : 'submarineSwapStats'
    ],
  );

  console.log(convertedSendAmount, 'CONVETTED SEND AMOUNT');

  const isLightningPayment = paymentInfo?.paymentNetwork === 'lightning';
  const isLiquidPayment = paymentInfo?.paymentNetwork === 'liquid';
  const isBitcoinPayment = paymentInfo?.paymentNetwork === 'Bitcoin';

  const minSendAmount = 1000 || minMaxLiquidSwapAmounts.min;
  const maxSendAmount = minMaxLiquidSwapAmounts.max || 23000000;

  const usedEcashProofs = useMemo(() => {
    const proofsToUse = getProofsToUse(
      ecashWalletInformation.proofs,
      convertedSendAmount,
    );
    return proofsToUse
      ? proofsToUse?.proofsToUse
      : ecashWalletInformation.proofs;
  }, [convertedSendAmount, ecashWalletInformation]);

  const {canUseEcash, canUseLiquid, canUseLightning} = usablePaymentNetwork({
    liquidNodeInformation,
    nodeInformation,
    eCashBalance,
    masterInfoObject,
    convertedSendAmount,
    isLiquidPayment,
    isLightningPayment,
    paymentInfo,
    isBitcoinPayment,
    minSendAmount,
    maxSendAmount,
  });
  console.log(canUseEcash, 'CAN USE ECASH');
  const lightningFee = canUseEcash
    ? Math.round(convertedSendAmount * 0.005) + 4
    : masterInfoObject.useTrampoline
    ? Math.round(convertedSendAmount * 0.005) + 4
    : null;

  const isReverseSwap =
    canUseLightning &&
    (!canUseLiquid || !canUseEcash) &&
    paymentInfo?.paymentNetwork === 'liquid';
  const isSubmarineSwap =
    canUseLiquid &&
    (!canUseLightning || !canUseEcash) &&
    paymentInfo?.paymentNetwork === 'lightning';
  const isSendingSwap = isReverseSwap || isSubmarineSwap;

  const canSendPayment =
    (canUseLiquid || canUseLightning) && sendingAmount != 0; //ecash is built into ln

  const isUsingSwapWithZeroInvoice =
    canUseLiquid &&
    paymentInfo?.paymentNetwork === 'lightning' &&
    paymentInfo.type === 'bolt11' &&
    !paymentInfo?.data?.invoice.amountMsat;

  // paymentInfo.type === 'bolt11' &&
  // paymentInfo.type != InputTypeVariant.LN_URL_PAY &&
  // !paymentInfo.invoice?.amountMsat;
  useHandleBackPressNew(goBackFunction);

  useEffect(() => {
    async function decodePayment() {
      crashlyticsLogReport('Begining decode payment process');
      const didPay = hasAlredyPaidInvoice({
        scannedAddress: btcAdress,
        nodeInformation,
        liquidNodeInformation,
        ecashWalletInformation,
      });
      console.log(didPay, 'DID PAY');
      if (didPay) {
        errorMessageNavigation('You have already paid this invoice');
        return;
      }
      crashlyticsLogReport('Starting decode address');
      await decodeSendAddress({
        nodeInformation,
        btcAdress,
        goBackFunction: errorMessageNavigation,
        setPaymentInfo,
        liquidNodeInformation,
        masterInfoObject,
        // setWebViewArgs,
        webViewRef,
        navigate,
        maxZeroConf:
          minMaxLiquidSwapAmounts?.submarineSwapStats?.limits?.maximalZeroConf,
        comingFromAccept,
        enteredPaymentInfo,
        setLoadingMessage,
        paymentInfo,
      });
    }
    setTimeout(decodePayment, 1000);
  }, []);

  useEffect(() => {
    console.log(
      !Object.keys(paymentInfo).length,
      '|',
      !masterInfoObject[QUICK_PAY_STORAGE_KEY].isFastPayEnabled,
      '|',
      !canSendPayment,
      '|',
      // paymentInfo.type === InputTypeVariant.LN_URL_PAY,
      // '|',
      !(
        masterInfoObject[QUICK_PAY_STORAGE_KEY].fastPayThresholdSats >=
        convertedSendAmount
      ),
      '|',
      // paymentInfo.type === 'liquid' && !paymentInfo.data.isBip21,
      'FAST PAY SETTINGS',
      masterInfoObject[QUICK_PAY_STORAGE_KEY].fastPayThresholdSats,
      convertedSendAmount,
    );

    if (!Object.keys(paymentInfo).length) return;
    if (!masterInfoObject[QUICK_PAY_STORAGE_KEY].isFastPayEnabled) return;
    if (!canSendPayment) return;
    if (canEditPaymentAmount) return;
    // if (paymentInfo.type === InputTypeVariant.LN_URL_PAY) return;
    if (
      !(
        masterInfoObject[QUICK_PAY_STORAGE_KEY].fastPayThresholdSats >=
        convertedSendAmount
      )
    )
      return;
    // if (paymentInfo.type === 'liquid' && !paymentInfo.data.isBip21) return;

    setTimeout(() => {
      sendPayment();
    }, 150);
  }, [paymentInfo, canEditPaymentAmount]);

  console.log(
    'LOADNIG OPTIONS',
    !Object.keys(paymentInfo).length ||
      (!canEditPaymentAmount &&
        (isLiquidPayment || (isSendingSwap && canUseLiquid))),
    Object.keys(paymentInfo).length,
    canEditPaymentAmount,
    isLiquidPayment,
    isSendingSwap,
    canUseLiquid,
    paymentInfo,
  );
  if (!Object.keys(paymentInfo).length && !errorMessage)
    return <FullLoadingScreen text={loadingMessage} />;

  if (errorMessage) {
    console.log('RUNNING ERROR COMPONENT');
    return <ErrorWithPayment reason={errorMessage} />;
  }

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      isKeyboardActive={!isAmountFocused}
      useStandardWidth={true}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={{position: 'absolute', zIndex: 99, left: 0}}
          onPress={goBackFunction}>
          <ThemeImage
            lightModeIcon={ICONS.smallArrowLeft}
            darkModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>

        <NavbarBalance />
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
        }}>
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={paymentInfo?.sendAmount || 0}
          inputDenomination={masterInfoObject.userBalanceDenomination}
          activeOpacity={!paymentInfo.sendAmount ? 0.5 : 1}
        />

        <FormattedSatText
          containerStyles={{opacity: !sendingAmount ? 0.5 : 1}}
          neverHideBalance={true}
          styles={{includeFontPadding: false, ...styles.satValue}}
          globalBalanceDenomination={
            masterInfoObject.userBalanceDenomination === 'sats' ||
            masterInfoObject.userBalanceDenomination === 'hidden'
              ? 'fiat'
              : 'sats'
          }
          balance={convertedSendAmount}
        />

        {!canEditPaymentAmount && (
          <SendTransactionFeeInfo
            canUseLightning={canUseLightning}
            canUseLiquid={canUseLiquid}
            isLightningPayment={isLightningPayment}
            swapFee={swapFee}
            lightningFee={lightningFee}
            isReverseSwap={isReverseSwap}
            isSubmarineSwap={isSubmarineSwap}
            isLiquidPayment={isLiquidPayment}
            paymentInfo={paymentInfo}
          />
        )}
      </ScrollView>
      {canEditPaymentAmount && (
        <>
          <SendMaxComponent
            nodeInformation={nodeInformation}
            eCashBalance={eCashBalance}
            paymentInfo={paymentInfo}
            navigate={navigate}
            setPaymentInfo={setPaymentInfo}
            isLiquidPayment={isLiquidPayment}
            isLightningPayment={isLightningPayment}
            masterInfoObject={masterInfoObject}
            isBitcoinPayment={isBitcoinPayment}
            liquidNodeInformation={liquidNodeInformation}
            minSendAmount={minSendAmount}
          />

          <CustomSearchInput
            onFocusFunction={() => setIsAmountFocused(false)}
            onBlurFunction={() => setIsAmountFocused(true)}
            placeholderText={'Description..'}
            setInputText={setPaymentDescription}
            inputText={paymentDescription}
            textInputMultiline={true}
            textAlignVertical={'center'}
            maxLength={paymentInfo?.data?.commentAllowed || 150}
            containerStyles={{
              width: '90%',
            }}
          />
          {isAmountFocused && (
            <NumberInputSendPage
              paymentInfo={paymentInfo}
              setPaymentInfo={setPaymentInfo}
              nodeInformation={nodeInformation}
            />
          )}
          {isAmountFocused && (
            <AcceptButtonSendPage
              canSendPayment={canSendPayment}
              decodeSendAddress={decodeSendAddress}
              errorMessageNavigation={errorMessageNavigation}
              btcAdress={btcAdress}
              paymentInfo={paymentInfo}
              convertedSendAmount={convertedSendAmount}
              paymentDescription={paymentDescription}
              // setSendingAmount={setSendingAmount}
              setPaymentInfo={setPaymentInfo}
              isSendingSwap={isSendingSwap}
              canUseLightning={canUseLightning}
              canUseLiquid={canUseLiquid}
              setLoadingMessage={setLoadingMessage}
              minSendAmount={minSendAmount}
              maxSendAmount={maxSendAmount}
            />
          )}
        </>
      )}
      {!canEditPaymentAmount && (
        <SwipeButtonNew
          onSwipeSuccess={sendPayment}
          width={0.95}
          resetAfterSuccessAnimDuration={true}
          shouldAnimateViewOnSuccess={true}
          shouldResetAfterSuccess={!canSendPayment}
          shouldDisplaySuccessState={isSendingPayment}
          containerStyles={{
            opacity: isSendingPayment
              ? 1
              : canSendPayment
              ? isBitcoinPayment
                ? canUseLightning || canUseLiquid
                  ? 1
                  : 0.2
                : isLightningPayment
                ? canUseLightning
                  ? 1
                  : convertedSendAmount >= minSendAmount &&
                    !isUsingSwapWithZeroInvoice
                  ? 1
                  : 0.2
                : canUseLiquid
                ? convertedSendAmount >= DUST_LIMIT_FOR_LBTC_CHAIN_PAYMENTS
                  ? 1
                  : 0.2
                : canUseLightning && convertedSendAmount >= minSendAmount
                ? 1
                : 0.2
              : 0.2,
          }}
          thumbIconStyles={{
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
            borderColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          }}
          railStyles={{
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
            borderColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          }}
        />
      )}
    </CustomKeyboardAvoidingView>
  );

  async function sendPayment() {
    if (!canSendPayment) return;
    if (isSendingPayment) return;
    setIsSendingPayment(true);

    if (paymentInfo.type === 'Bitcoin') {
      if (!(canUseLightning || canUseLiquid)) return;

      const from = canUseLiquid ? 'liquid' : 'lightning';
      const sendOnChainPayment = await sendBitcoinPayment({
        paymentInfo,
        sendingValue: convertedSendAmount,
        from,
      });

      if (!sendOnChainPayment.didWork) {
        navigate.reset({
          index: 0, // The top-level route index
          routes: [
            {
              name: 'HomeAdmin', // Navigate to HomeAdmin
              params: {
                screen: 'Home',
              },
            },
            {
              name: 'ConfirmTxPage',
              params: {
                for: 'paymentFailed',
                information: {
                  status: 'failed',
                  feeSat: 0,
                  amountSat: 0,
                  details: {error: sendOnChainPayment.error},
                },
                formattingType: 'liquidNode', //chose for more control, this is actualy a lighting payment
              },
            },
          ],
        });
      } else {
        navigate.reset({
          index: 0,
          routes: [
            {
              name: 'HomeAdmin',
              params: {
                screen: 'Home',
              },
            },
            {
              name: 'ConfirmTxPage',
              params: {
                for: 'paymentSucceed',
                information: {
                  details: {type: 'Bitcoin'},
                  status: 'pending',
                  feesSat: sendOnChainPayment.fees,
                  amountSat: sendOnChainPayment.amount,
                },
                formattingType: 'liquidNode', //chose for more control, this is actualy a lighting payment
              },
            },
          ],
        });
      }
      return;
    }
    if (paymentInfo?.type === InputTypeVariant.BOLT12_OFFER) {
      await sendBolt12Offer_sendPaymentScreen({
        sendingAmount: convertedSendAmount,
        paymentInfo,
        navigate,
        fromPage,
        publishMessageFunc,
      });
      return;
    }

    if (canUseEcash) {
      await sendPaymentUsingEcash({
        paymentInfo,
        convertedSendAmount,
        isLiquidPayment,
        navigate,
        setIsSendingPayment,
        publishMessageFunc,
        fromPage,
        paymentDescription:
          paymentDescription || paymentInfo?.data.message || '',
        webViewRef,
      });
      return;
    }

    if (isLightningPayment) {
      if (canUseLightning) {
        sendLightningPayment_sendPaymentScreen({
          sendingAmount: convertedSendAmount,
          paymentInfo,
          navigate,
          fromPage,
          publishMessageFunc,
          paymentDescription:
            paymentDescription || paymentInfo?.data.message || '',
        });
      } else if (
        convertedSendAmount >= minSendAmount &&
        !isUsingSwapWithZeroInvoice &&
        convertedSendAmount <= maxSendAmount
      ) {
        const shouldDrain =
          liquidNodeInformation.userBalance - convertedSendAmount <
          LIQUID_NON_BITCOIN_DRAIN_LIMIT
            ? true
            : false;
        sendToLNFromLiquid_sendPaymentScreen({
          paymentInfo,
          navigate,
          sendingAmount: convertedSendAmount,
          fromPage,
          publishMessageFunc,
          paymentDescription:
            paymentDescription || paymentInfo?.data.message || '',
          shouldDrain,
        });
      } else {
        setIsSendingPayment(false);
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Cannot send payment.',
        });
      }
    } else {
      if (canUseLiquid) {
        sendLiquidPayment_sendPaymentScreen({
          sendingAmount: convertedSendAmount,
          paymentInfo,
          navigate,
          fromPage,
          publishMessageFunc,
          paymentDescription:
            paymentDescription || paymentInfo?.data.message || '',
        });
      } else if (
        nodeInformation.userBalance >
          convertedSendAmount + LIGHTNINGAMOUNTBUFFER + swapFee &&
        convertedSendAmount >= minSendAmount &&
        convertedSendAmount <= maxSendAmount
      ) {
        sendToLiquidFromLightning_sendPaymentScreen({
          paymentInfo,
          sendingAmount: convertedSendAmount,
          navigate,
          webViewRef,
          fromPage,
          publishMessageFunc,
          paymentDescription:
            paymentDescription || paymentInfo?.data.message || '',
        });
      } else {
        setIsSendingPayment(false);
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Cannot send payment.',
        });
      }
    }
  }

  function goBackFunction() {
    keyboardGoBack(navigate);
  }
  function errorMessageNavigation(reason) {
    navigate.navigate('ConfirmPaymentScreen', {
      btcAdress: '',
      fromPage: '',
      publishMessageFunc: null,
      comingFromAccept: null,
      enteredPaymentInfo: {},
      errorMessage: reason || 'Error decoding invoice',
    });
  }
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
});
