import {fetchOnchainLimits} from '@breeztech/react-native-breez-sdk-liquid';
import {formatBalanceAmount, numberConverter} from '../../../../../functions';
import {sendBitcoinPayment} from './payments';
import {SATSPERBITCOIN} from '../../../../../constants';

export default async function processBitcoinAddress(input, context) {
  const {
    nodeInformation,
    liquidNodeInformation,
    masterInfoObject,
    navigate,
    goBackFunction,
    comingFromAccept,
    enteredPaymentInfo,
  } = context;
  try {
    const currentLimits = await fetchOnchainLimits();
    const amountSat = comingFromAccept
      ? enteredPaymentInfo.amount
      : input.address.amountSat || 0;

    const fromNetwork = comingFromAccept
      ? enteredPaymentInfo.from
      : liquidNodeInformation.userBalance > amountSat
      ? 'liquid'
      : nodeInformation.userBalance > amountSat
      ? 'lightning'
      : 'none';

    const shouldDrain =
      fromNetwork === 'liquid'
        ? liquidNodeInformation.userBalance - amountSat < 500
        : nodeInformation.userBalance - amountSat < 500;

    if (
      (currentLimits.send.minSat > amountSat ||
        currentLimits.send.maxSat < amountSat) &&
      amountSat
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: `${
          amountSat < currentLimits.send.minSat ? 'Minimum' : 'Maximum'
        } send amount ${formatBalanceAmount(
          numberConverter(
            currentLimits.send[
              amountSat < currentLimits.send.minSat ? 'minSat' : 'maxSat'
            ],
            masterInfoObject.userBalanceDenomination,
            nodeInformation,
            masterInfoObject.userBalanceDenomination === 'fiat' ? 2 : 0,
          ),
        )}`,
        customNavigator: () => goBackFunction(),
      });
      return;
    }
    const fiatValue =
      Number(amountSat) /
      (SATSPERBITCOIN / (nodeInformation.fiatStats?.value || 65000));
    let paymentInfo = {
      address: input.address.address,
      amount: amountSat,
      label: input.address.label || '',
      limits: currentLimits.send,
      shouldDrain,
    };
    let paymentFee = 0;
    if (amountSat) {
      const paymentFeeResponse = await sendBitcoinPayment({
        paymentInfo: {data: paymentInfo},
        sendingValue: amountSat,
        onlyPrepare: true,
        from: fromNetwork,
      });
      if (paymentFeeResponse.didWork) {
        paymentFee = paymentFeeResponse.fees;
      } else {
        navigate.navigate('ErrorScreen', {
          errorMessage: `Sending amount is above your balance`,
          customNavigator: () => goBackFunction(),
        });
        return;
      }
    }
    paymentInfo = {
      ...paymentInfo,
      fee: paymentFee,
    };

    return {
      data: paymentInfo,
      type: 'Bitcoin',
      paymentNetwork: 'Bitcoin',
      sendAmount: !amountSat
        ? ''
        : `${
            masterInfoObject.userBalanceDenomination != 'fiat'
              ? `${amountSat}`
              : fiatValue < 0.01
              ? ''
              : `${fiatValue.toFixed(2)}`
          }`,
      canEditPayment:
        comingFromAccept || input.address.amountSat ? false : true,
    };
  } catch (err) {
    console.log('process bitcoin address error', err);
    return false;
  }
}
