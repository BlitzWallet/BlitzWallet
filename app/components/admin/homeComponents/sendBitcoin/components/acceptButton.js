import {useNavigation} from '@react-navigation/native';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {CENTER, SATSPERBITCOIN} from '../../../../../constants';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useState} from 'react';
import {getLNAddressForLiquidPayment} from '../functions/payments';
import {formatBalanceAmount, numberConverter} from '../../../../../functions';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../../context-store/appStatus';

export default function AcceptButtonSendPage({
  canSendPayment,
  decodeSendAddress,
  errorMessageNavigation,
  btcAdress,
  paymentInfo,
  convertedSendAmount,
  paymentDescription,
  //   setSendingAmount,
  setPaymentInfo,
  isSendingSwap,
  canUseLightning,
  canUseLiquid,
}) {
  const {masterInfoObject} = useGlobalContextProvider();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();

  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const navigate = useNavigation();
  return (
    <CustomButton
      buttonStyles={{
        opacity:
          canSendPayment &&
          !(
            isSendingSwap &&
            paymentInfo?.data?.invoice?.amountMsat === null &&
            !canUseLightning
          ) &&
          !(
            paymentInfo.type === 'Bitcoin' &&
            (convertedSendAmount < paymentInfo.data.limits.minSat ||
              convertedSendAmount > paymentInfo.data.limits.maxSat)
          )
            ? 1
            : 0.5,
        width: 'auto',
        ...CENTER,
        marginTop: 15,
      }}
      textStyles={{
        includeFontPadding: false,
      }}
      useLoading={isGeneratingInvoice}
      actionFunction={handleEnterSendAmount}
      textContent={'Accept'}
    />
  );

  async function handleEnterSendAmount() {
    if (!paymentInfo?.sendAmount) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Please enter a send amount',
      });
      return;
    }
    if (
      paymentInfo.type === 'Bitcoin' &&
      (convertedSendAmount < paymentInfo.data.limits.minSat ||
        convertedSendAmount > paymentInfo.data.limits.maxSat)
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: `${
          convertedSendAmount <= paymentInfo.data.limits.minSat
            ? 'Minimum'
            : 'Maximum'
        } send amount ${formatBalanceAmount(
          numberConverter(
            paymentInfo.data.limits[
              convertedSendAmount <= paymentInfo.data.limits.minSat
                ? 'minSat'
                : 'maxSat'
            ],
            masterInfoObject.userBalanceDenomination,
            nodeInformation,
            masterInfoObject.userBalanceDenomination === 'fiat' ? 2 : 0,
          ),
        )}`,
      });
      return;
    }
    if (
      isSendingSwap &&
      paymentInfo?.data?.invoice?.amountMsat === null &&
      !canUseLightning
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Cannot send to zero amount invoice from the bank',
      });
      return;
    }
    if (!canSendPayment && !!paymentInfo?.sendAmount) {
      navigate.navigate('ErrorScreen', {
        errorMessage:
          isSendingSwap &&
          (paymentInfo?.sendAmount < minMaxLiquidSwapAmounts.min ||
            paymentInfo?.sendAmount > minMaxLiquidSwapAmounts.max)
            ? `${
                paymentInfo?.sendAmount < minMaxLiquidSwapAmounts.min
                  ? 'Minimum'
                  : 'Maximum'
              } send amount ${formatBalanceAmount(
                numberConverter(
                  minMaxLiquidSwapAmounts[
                    paymentInfo?.sendAmount < minMaxLiquidSwapAmounts.min
                      ? 'min'
                      : 'max'
                  ],
                  masterInfoObject.userBalanceDenomination,
                  nodeInformation,
                  masterInfoObject.userBalanceDenomination === 'fiat' ? 2 : 0,
                ),
              )}`
            : 'Not enough funds to cover fees',
      });
      return;
    }
    if (!canSendPayment) return;
    setIsGeneratingInvoice(true);
    try {
      console.log(paymentInfo);
      // let invoice;

      // if (paymentInfo?.type === InputTypeVariant.LN_URL_PAY) {
      //   invoice = await getLNAddressForLiquidPayment(
      //     paymentInfo,
      //     convertedSendAmount,
      //     paymentDescription,
      //   );
      // } else if (paymentInfo?.type === 'liquid') {
      //   invoice = `${
      //     process.env.BOLTZ_ENVIRONMENT === 'testnet'
      //       ? 'liquidtestnet:'
      //       : 'liquidnetwork:'
      //   }${btcAdress}?amount=${(convertedSendAmount / SATSPERBITCOIN).toFixed(
      //     8,
      //   )}&assetid=${assetIDS['L-BTC']}`;
      // } else {
      //   invoice = paymentInfo?.data.invoice?.bolt11;
      // }
      // return;

      decodeSendAddress({
        nodeInformation,
        btcAdress: btcAdress,
        goBackFunction: errorMessageNavigation,
        // setIsLightningPayment,
        // setSendingAmount,
        setPaymentInfo,
        // setIsLoading,
        liquidNodeInformation,
        masterInfoObject,
        navigate,
        maxZeroConf:
          minMaxLiquidSwapAmounts?.submarineSwapStats?.limits?.maximalZeroConf,
        comingFromAccept: true,
        enteredPaymentInfo: {
          amount: convertedSendAmount,
          description: paymentDescription,
          from: canUseLiquid ? 'liquid' : 'lightning',
        },
      });
    } catch (err) {
      console.log(err);
    }
  }
}
