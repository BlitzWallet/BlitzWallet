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
import {useSparkWallet} from '../../../../../context-store/sparkContext';
import {sparkPaymenWrapper} from '../../../../functions/spark/payments';
import {getBoltzApiUrl} from '../../../../functions/boltz/boltzEndpoitns';

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

  const {sparkInformation} = useSparkWallet();
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {nodeInformation, liquidNodeInformation, fiatStats} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  // const {ecashWalletInformation} = useGlobaleCash();
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

  // const eCashBalance = ecashWalletInformation.balance;
  const sendingAmount = paymentInfo?.sendAmount || 0;
  const isBTCdenominated =
    masterInfoObject.userBalanceDenomination === 'hidden' ||
    masterInfoObject.userBalanceDenomination === 'sats';
  const canEditPaymentAmount = paymentInfo?.canEditPayment;
  const convertedSendAmount = isBTCdenominated
    ? Math.round(Number(sendingAmount))
    : Math.round((SATSPERBITCOIN / fiatStats?.value) * Number(sendingAmount));
  // const swapFee = calculateBoltzFeeNew(
  //   Number(convertedSendAmount),
  //   paymentInfo.type === 'liquid' ? 'ln-liquid' : 'liquid-ln',
  //   minMaxLiquidSwapAmounts[
  //     paymentInfo.type === 'liquid' ? 'reverseSwapStats' : 'submarineSwapStats'
  //   ],
  // );

  console.log(convertedSendAmount, 'CONVETTED SEND AMOUNT');

  const isLightningPayment = paymentInfo?.paymentNetwork === 'lightning';
  const isLiquidPayment = paymentInfo?.paymentNetwork === 'liquid';
  const isBitcoinPayment = paymentInfo?.paymentNetwork === 'Bitcoin';
  const isSparkPayment = paymentInfo?.paymentNetwork === 'spark';

  // const minSendAmount = 1000 || minMaxLiquidSwapAmounts.min;
  // const maxSendAmount = minMaxLiquidSwapAmounts.max || 23000000;

  // const {canUseEcash, canUseLiquid, canUseLightning} = usablePaymentNetwork({
  //   liquidNodeInformation,
  //   nodeInformation,
  //   eCashBalance,
  //   masterInfoObject,
  //   convertedSendAmount,
  //   isLiquidPayment,
  //   isLightningPayment,
  //   paymentInfo,
  //   isBitcoinPayment,
  //   minSendAmount,
  //   maxSendAmount,
  // });
  // console.log(canUseEcash, 'CAN USE ECASH');
  // const lightningFee = canUseEcash
  //   ? Math.round(convertedSendAmount * 0.005) + 4
  //   : masterInfoObject.useTrampoline
  //   ? Math.round(convertedSendAmount * 0.005) + 4
  //   : null;

  // const isReverseSwap =
  //   canUseLightning &&
  //   (!canUseLiquid || !canUseEcash) &&
  //   paymentInfo?.paymentNetwork === 'liquid';
  // const isSubmarineSwap =
  //   canUseLiquid &&
  //   (!canUseLightning || !canUseEcash) &&
  //   paymentInfo?.paymentNetwork === 'lightning';
  // const isSendingSwap = isReverseSwap || isSubmarineSwap;

  const paymentFee =
    (paymentInfo?.paymentFee || 0) + (paymentInfo?.supportFee || 0);
  const canSendPayment =
    Number(sparkInformation.balance) >= Number(sendingAmount) + paymentFee &&
    sendingAmount != 0; //ecash is built into ln
  console.log(
    canSendPayment,
    'can send payment',
    sparkInformation.balance,
    sendingAmount,
    paymentFee,
    sendingAmount,
    paymentInfo,
  ); //ecash is built into ln);
  const isUsingSwapWithZeroInvoice =
    paymentInfo?.paymentNetwork === 'lightning' &&
    paymentInfo.type === 'bolt11' &&
    !paymentInfo?.data?.invoice.amountMsat;

  useHandleBackPressNew(goBackFunction);

  useEffect(() => {
    async function decodePayment() {
      crashlyticsLogReport('Begining decode payment process');
      const didPay = hasAlredyPaidInvoice({
        scannedAddress: btcAdress,
        sparkInformation,
      });
      console.log(didPay, 'DID PAY');
      if (didPay) {
        errorMessageNavigation('You have already paid this invoice');
        return;
      }
      crashlyticsLogReport('Starting decode address');
      await decodeSendAddress({
        fiatStats,
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
        fromPage,
        publishMessageFunc,
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

  useEffect(() => {
    // unmounting started websocket if it exists
    const unsubscribe = navigate.addListener('beforeRemove', () => {
      console.log('Really leaving the screen, closing websocket');
      if (paymentInfo?.websocket?.readyState === WebSocket.OPEN) {
        paymentInfo.websocket.close();
      }
    });

    return unsubscribe;
  }, [navigate, paymentInfo]);

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
            paymentFee={paymentFee}
            isLightningPayment={isLightningPayment}
            isLiquidPayment={isLiquidPayment}
            isBitcoinPayment={isBitcoinPayment}
            isSparkPayment={isSparkPayment}
          />
        )}
      </ScrollView>
      {canEditPaymentAmount && (
        <>
          <SendMaxComponent
            fiatStats={fiatStats}
            sparkInformation={sparkInformation}
            paymentInfo={paymentInfo}
            setPaymentInfo={setPaymentInfo}
            masterInfoObject={masterInfoObject}
            nodeInformation={nodeInformation}
            paymentFee={paymentFee}
            paymentType={paymentInfo?.paymentNetwork}
            minMaxLiquidSwapAmounts={minMaxLiquidSwapAmounts}
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
              fiatStats={fiatStats}
            />
          )}
          {isAmountFocused && (
            <AcceptButtonSendPage
              isUsingSwapWithZeroInvoice={isUsingSwapWithZeroInvoice}
              isLiquidPayment={isLiquidPayment}
              canSendPayment={canSendPayment}
              decodeSendAddress={decodeSendAddress}
              errorMessageNavigation={errorMessageNavigation}
              btcAdress={btcAdress}
              paymentInfo={paymentInfo}
              convertedSendAmount={convertedSendAmount}
              paymentDescription={paymentDescription}
              setPaymentInfo={setPaymentInfo}
              setLoadingMessage={setLoadingMessage}
              fromPage={fromPage}
              publishMessageFunc={publishMessageFunc}
              webViewRef={webViewRef}
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
            opacity: isSendingPayment ? 1 : canSendPayment ? 1 : 0.2,
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

    let formmateedSparkPaymentInfo = {
      address: '',
      paymentType: '',
    };

    // manipulate paymetn details here
    if (paymentInfo.type === 'bolt11') {
      formmateedSparkPaymentInfo.address =
        paymentInfo?.decodedInput?.invoice?.bolt11;
      formmateedSparkPaymentInfo.paymentType = 'lightning';
    } else if (paymentInfo.type === 'spark') {
      formmateedSparkPaymentInfo.address = paymentInfo?.data?.address;
      formmateedSparkPaymentInfo.paymentType = 'spark';
    } else if (paymentInfo.type === 'lnUrlPay') {
      formmateedSparkPaymentInfo.address = paymentInfo?.data?.invoice;
      formmateedSparkPaymentInfo.paymentType = 'lightning';
    } else if (paymentInfo.type === 'liquid') {
      formmateedSparkPaymentInfo.address = paymentInfo?.data?.invoice;
      formmateedSparkPaymentInfo.paymentType = 'lightning';
      console.log(paymentInfo?.boltzData);
    } else if (paymentInfo?.type === 'Bitcoin') {
      formmateedSparkPaymentInfo.address = paymentInfo?.address;
      formmateedSparkPaymentInfo.paymentType = 'bitcoin';
    }
    console.log(formmateedSparkPaymentInfo, 'manual spark information');

    const paymentObject = {
      getFee: false,
      ...formmateedSparkPaymentInfo,
      amountSats:
        paymentInfo?.type === 'Bitcoin'
          ? convertedSendAmount + paymentFee
          : convertedSendAmount,
      masterInfoObject,
      fee: paymentFee,
      memo: paymentDescription || paymentInfo?.data.message || '',
      userBalance: sparkInformation.balance,
      sparkInformation,
    };

    // Shouuld be same for all paymetns
    const paymentResponse = await sparkPaymenWrapper(paymentObject);

    if (paymentInfo.type === 'liquid' && paymentResponse.didWork) {
      async function pollBoltzSwapStatus() {
        let didSettleInvoice = false;
        let runCount = 0;

        while (!didSettleInvoice && runCount < 10) {
          runCount += 1;
          const resposne = await fetch(
            getBoltzApiUrl() + `/v2/swap/${paymentInfo.boltzData.id}`,
          );
          const boltzData = await resposne.json();
          console.log(boltzData);

          if (boltzData.status === 'invoice.settled') {
            didSettleInvoice = true;
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
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
                        transaction: paymentResponse.response,
                      },
                    },
                  ],
                });
              });
            });
          } else {
            console.log('Waiting for confirmation....');
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        if (didSettleInvoice) return;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
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
                    transaction: paymentResponse.response,
                    error: 'Unable to settle swap',
                  },
                },
              ],
            });
          });
        });
      }
      pollBoltzSwapStatus();
      return;
    }

    if (paymentResponse.didWork) {
      if (fromPage === 'contacts') {
        publishMessageFunc();
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
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
                  transaction: paymentResponse.response,
                },
              },
            ],
          });
        });
      });
    } else {
      if (paymentInfo?.webSocket) {
        paymentInfo?.webSocket?.close();
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
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
                  transaction: paymentResponse.response,
                  error: paymentResponse.error,
                },
              },
            ],
          });
        });
      });
    }

    return;

    // if (paymentInfo.type === 'Bitcoin') {
    //   if (!(canUseLightning || canUseLiquid)) return;

    //   const from = canUseLiquid ? 'liquid' : 'lightning';
    //   const sendOnChainPayment = await sendBitcoinPayment({
    //     paymentInfo,
    //     sendingValue: convertedSendAmount,
    //     from,
    //   });

    //   if (!sendOnChainPayment.didWork) {
    //     navigate.reset({
    //       index: 0, // The top-level route index
    //       routes: [
    //         {
    //           name: 'HomeAdmin', // Navigate to HomeAdmin
    //           params: {
    //             screen: 'Home',
    //           },
    //         },
    //         {
    //           name: 'ConfirmTxPage',
    //           params: {
    //             for: 'paymentFailed',
    //             information: {
    //               status: 'failed',
    //               feeSat: 0,
    //               amountSat: 0,
    //               details: {error: sendOnChainPayment.error},
    //             },
    //             formattingType: 'liquidNode', //chose for more control, this is actualy a lighting payment
    //           },
    //         },
    //       ],
    //     });
    //   } else {
    //     navigate.reset({
    //       index: 0,
    //       routes: [
    //         {
    //           name: 'HomeAdmin',
    //           params: {
    //             screen: 'Home',
    //           },
    //         },
    //         {
    //           name: 'ConfirmTxPage',
    //           params: {
    //             for: 'paymentSucceed',
    //             information: {
    //               details: {type: 'Bitcoin'},
    //               status: 'pending',
    //               feesSat: sendOnChainPayment.fees,
    //               amountSat: sendOnChainPayment.amount,
    //             },
    //             formattingType: 'liquidNode', //chose for more control, this is actualy a lighting payment
    //           },
    //         },
    //       ],
    //     });
    //   }
    //   return;
    // }
    // if (paymentInfo?.type === InputTypeVariant.BOLT12_OFFER) {
    //   await sendBolt12Offer_sendPaymentScreen({
    //     sendingAmount: convertedSendAmount,
    //     paymentInfo,
    //     navigate,
    //     fromPage,
    //     publishMessageFunc,
    //   });
    //   return;
    // }

    // if (canUseEcash) {
    //   await sendPaymentUsingEcash({
    //     paymentInfo,
    //     convertedSendAmount,
    //     isLiquidPayment,
    //     navigate,
    //     setIsSendingPayment,
    //     publishMessageFunc,
    //     fromPage,
    //     paymentDescription:
    //       paymentDescription || paymentInfo?.data.message || '',
    //     webViewRef,
    //   });
    //   return;
    // }

    // if (isLightningPayment) {
    //   if (canUseLightning) {
    //     sendLightningPayment_sendPaymentScreen({
    //       sendingAmount: convertedSendAmount,
    //       paymentInfo,
    //       navigate,
    //       fromPage,
    //       publishMessageFunc,
    //       paymentDescription:
    //         paymentDescription || paymentInfo?.data.message || '',
    //     });
    //   } else if (
    //     convertedSendAmount >= minSendAmount &&
    //     !isUsingSwapWithZeroInvoice &&
    //     convertedSendAmount <= maxSendAmount
    //   ) {
    //     const shouldDrain =
    //       liquidNodeInformation.userBalance - convertedSendAmount <
    //       LIQUID_NON_BITCOIN_DRAIN_LIMIT
    //         ? true
    //         : false;
    //     sendToLNFromLiquid_sendPaymentScreen({
    //       paymentInfo,
    //       navigate,
    //       sendingAmount: convertedSendAmount,
    //       fromPage,
    //       publishMessageFunc,
    //       paymentDescription:
    //         paymentDescription || paymentInfo?.data.message || '',
    //       shouldDrain,
    //     });
    //   } else {
    //     setIsSendingPayment(false);
    //     navigate.navigate('ErrorScreen', {
    //       errorMessage: 'Cannot send payment.',
    //     });
    //   }
    // } else {
    //   if (canUseLiquid) {
    //     sendLiquidPayment_sendPaymentScreen({
    //       sendingAmount: convertedSendAmount,
    //       paymentInfo,
    //       navigate,
    //       fromPage,
    //       publishMessageFunc,
    //       paymentDescription:
    //         paymentDescription || paymentInfo?.data.message || '',
    //     });
    //   } else if (
    //     nodeInformation.userBalance >
    //       convertedSendAmount + LIGHTNINGAMOUNTBUFFER + swapFee &&
    //     convertedSendAmount >= minSendAmount &&
    //     convertedSendAmount <= maxSendAmount
    //   ) {
    //     sendToLiquidFromLightning_sendPaymentScreen({
    //       paymentInfo,
    //       sendingAmount: convertedSendAmount,
    //       navigate,
    //       webViewRef,
    //       fromPage,
    //       publishMessageFunc,
    //       paymentDescription:
    //         paymentDescription || paymentInfo?.data.message || '',
    //     });
    //   } else {
    //     setIsSendingPayment(false);
    //     navigate.navigate('ErrorScreen', {
    //       errorMessage: 'Cannot send payment.',
    //     });
    //   }
    // }
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
