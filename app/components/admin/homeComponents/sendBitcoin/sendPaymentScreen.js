import {StyleSheet, View, TouchableOpacity, ScrollView} from 'react-native';
import {
  CENTER,
  COLORS,
  ICONS,
  QUICK_PAY_STORAGE_KEY,
  SATSPERBITCOIN,
  SIZES,
} from '../../../../constants';
import {useEffect, useMemo, useState} from 'react';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import SwipeButton from 'rn-swipe-button';
import SendTransactionFeeInfo from './components/feeInfo';
import decodeSendAddress from './functions/decodeSendAdress';
import {useNavigation} from '@react-navigation/native';
import {
  getLNAddressForLiquidPayment,
  sendBitcoinPayment,
  sendLightningPayment_sendPaymentScreen,
  sendLiquidPayment_sendPaymentScreen,
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
  getMeltQuote,
  getProofsToUse,
  payLnInvoiceFromEcash,
} from '../../../../functions/eCash/wallet';
import handleBackPressNew from '../../../../hooks/handleBackPressNew';

export default function SendPaymentScreen(props) {
  console.log('CONFIRM SEND PAYMENT SCREEN');
  const navigate = useNavigation();
  const {
    btcAdress,
    fromPage,
    publishMessageFunc,
    comingFromAccept,
    enteredPaymentInfo,
  } = props.route.params;

  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {ecashWalletInformation} = useGlobaleCash();
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();
  const {webViewRef, setWebViewArgs} = useWebView();

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
    swapFee,
    minMaxLiquidSwapAmounts,
    isLiquidPayment,
    isLightningPayment,
    paymentInfo,
    isBitcoinPayment,
    usedEcashProofs,
    ecashWalletInformation,
  });
  const lightningFee = canUseEcash
    ? calculateEcashFees(ecashWalletInformation.mintURL, usedEcashProofs)
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
  handleBackPressNew(goBackFunction);

  useEffect(() => {
    async function decodePayment() {
      const didPay = hasAlredyPaidInvoice({
        scannedAddress: btcAdress,
        nodeInformation,
        liquidNodeInformation,
      });
      console.log(didPay, 'DID PAY');
      if (didPay) {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'You have already paid this invoice',
          customNavigator: () => errorMessageNavigation(),
        });
        return;
      }
      await decodeSendAddress({
        nodeInformation,
        btcAdress,
        goBackFunction: errorMessageNavigation,
        setPaymentInfo,
        liquidNodeInformation,
        masterInfoObject,
        setWebViewArgs,
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
  if (!Object.keys(paymentInfo).length)
    return <FullLoadingScreen text={loadingMessage} />;

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
            minMaxLiquidSwapAmounts={minMaxLiquidSwapAmounts}
            masterInfoObject={masterInfoObject}
            isBitcoinPayment={isBitcoinPayment}
            liquidNodeInformation={liquidNodeInformation}
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
            />
          )}
        </>
      )}
      {!canEditPaymentAmount && (
        <View
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            position: 'relative',
          }}>
          <SwipeButton
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
                    : convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
                      !isUsingSwapWithZeroInvoice
                    ? 1
                    : 0.2
                  : canUseLiquid
                  ? convertedSendAmount >= DUST_LIMIT_FOR_LBTC_CHAIN_PAYMENTS
                    ? 1
                    : 0.2
                  : canUseLightning &&
                    convertedSendAmount >= minMaxLiquidSwapAmounts.min
                  ? 1
                  : 0.2
                : 0.2,
              width: '100%',
              maxWidth: 350,
              borderColor: textColor,
              ...CENTER,
            }}
            titleStyles={{fontWeight: '500', fontSize: SIZES.large}}
            swipeSuccessThreshold={100}
            onSwipeSuccess={sendPayment}
            shouldResetAfterSuccess={false}
            railBackgroundColor={
              isSendingPayment
                ? COLORS.darkModeText
                : theme
                ? backgroundOffset
                : COLORS.primary
            }
            railBorderColor={
              theme ? backgroundOffset : COLORS.lightModeBackground
            }
            height={55}
            railStyles={{
              backgroundColor: COLORS.darkModeText,
              borderColor: COLORS.darkModeText,
            }}
            thumbIconBackgroundColor={COLORS.darkModeText}
            thumbIconBorderColor={COLORS.darkModeText}
            titleColor={COLORS.darkModeText}
            title={'Slide to confirm'}
          />
          {isSendingPayment && (
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                position: 'absolute',
                zIndex: 1,
              }}>
              <ThemeText
                styles={{
                  color: theme ? backgroundColor : COLORS.lightModeText,
                  fontWeight: '500',
                  fontSize: SIZES.large,
                  includeFontPadding: false,
                  marginRight: 10,
                }}
                content={'Sending payment'}
              />
              <FullLoadingScreen
                containerStyles={{flex: 0}}
                size="small"
                loadingColor={theme ? backgroundColor : COLORS.lightModeText}
                showText={false}
              />
            </View>
          )}
        </View>
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

    if (canUseEcash) {
      const sendingInvoice = await getLNAddressForLiquidPayment(
        paymentInfo,
        convertedSendAmount,
      );

      if (!sendingInvoice) {
        navigate.navigate('ErrorScreen', {
          errorMessage:
            'Unable to create an invoice for the lightning address.',
        });
        setIsSendingPayment(false);
        return;
      }
      const meltQuote = await getMeltQuote(sendingInvoice);
      if (!meltQuote) {
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
                  fee: 0,
                  amountSat: 0,
                  details: {
                    error: 'Not able to generate ecash quote or proofs',
                  },
                },
                formattingType: 'ecash',
              },
            },
          ],
        });
        return;
      }
      const didPay = await payLnInvoiceFromEcash({
        quote: meltQuote.quote,
        invoice: sendingInvoice,
        proofsToUse: meltQuote.proofsToUse,
        description: paymentInfo?.data?.message || '',
      });
      if (didPay.didWork && fromPage === 'contacts') {
        publishMessageFunc();
      }

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
            name: 'ConfirmTxPage', // Navigate to ExpandedAddContactsPage
            params: {
              for: didPay.didWork ? 'paymentSucceed' : 'paymentFailed',
              information: {
                status: didPay.didWork ? 'complete' : 'failed',
                feeSat: didPay.txObject?.fee,
                amountSat: didPay.txObject?.amount,
                details: didPay.didWork
                  ? {error: ''}
                  : {
                      error: didPay.message,
                    },
              },
              formattingType: 'ecash',
            },
          },
        ],
        // Array of routes to set in the stack
      });

      return;
    }

    setWebViewArgs({
      navigate: navigate,
      page: 'sendingPage',
    });

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
        convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
        !isUsingSwapWithZeroInvoice &&
        convertedSendAmount <= minMaxLiquidSwapAmounts.max
      ) {
        const shouldDrain =
          liquidNodeInformation.userBalance - convertedSendAmount < 10
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
        convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
        convertedSendAmount <= minMaxLiquidSwapAmounts.max
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
    navigate.goBack();
  }
  function errorMessageNavigation() {
    navigate.navigate('HomeAdmin', {screen: 'Home'});
  }
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
});
