import {SATSPERBITCOIN} from '../../../../../constants';
import {getBoltzWsUrl} from '../../../../../functions/boltz/boltzEndpoitns';
import {calculateBoltzFeeNew} from '../../../../../functions/boltz/boltzFeeNew';
import handleReverseClaimWSS from '../../../../../functions/boltz/handle-reverse-claim-wss';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../../../functions/crashlyticsLogs';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';
import {contactsLNtoLiquidSwapInfo} from '../../contacts/internalComponents/LNtoLiquidSwap';

export default async function processLiquidAddress(input, context) {
  const {
    masterInfoObject,
    comingFromAccept,
    enteredPaymentInfo,
    fiatStats,
    webViewRef,
    fromPage,
    publishMessageFunc,
  } = context;
  let webSocket;
  console.log(webViewRef, 'WEB VIEW REF');
  try {
    crashlyticsLogReport('Handling decode liquid address');
    let addressInfo = JSON.parse(JSON.stringify(input?.address));
    let paymentFee = 0;
    let supportFee = 0;
    let boltzData;

    if (comingFromAccept) {
      addressInfo.amount = enteredPaymentInfo.amount;
      addressInfo.label =
        enteredPaymentInfo.description || input?.address?.label || '';
      addressInfo.message =
        enteredPaymentInfo.description || input?.address?.message || '';
      addressInfo.isBip21 = true;
      const {data, publicKey, privateKey, keys, preimage, liquidAddress} =
        await contactsLNtoLiquidSwapInfo(
          input?.address.address,
          Number(enteredPaymentInfo.amount),
          enteredPaymentInfo.description || input?.address?.label || '',
        );

      if (!data?.invoice) throw new Error('No Swap invoice genereated');
      boltzData = data;
      webSocket = new WebSocket(
        `${getBoltzWsUrl(process.env.BOLTZ_ENVIRONMENT)}`,
      );
      const didHandle = await handleReverseClaimWSS({
        ref: webViewRef,
        webSocket: webSocket,
        liquidAddress: liquidAddress,
        swapInfo: data,
        preimage: preimage,
        privateKey: privateKey,
        fromPage: fromPage,
        contactsFunction: publishMessageFunc,
      });
      if (!didHandle) throw new Error('Unable to open websocket');

      const fee = await sparkPaymenWrapper({
        getFee: true,
        address: data.invoice,
        amountSats: Math.round(enteredPaymentInfo.amount),
        paymentType: 'lightning',
        masterInfoObject,
      });

      if (!fee.didWork) throw new Error(fee.error);

      paymentFee = fee.fee;
      supportFee = fee.supportFee;
      addressInfo.invoice = data.invoice;
    } else {
      addressInfo.amount = addressInfo.amountSat;
    }

    const amountSat = addressInfo.amount;
    const fiatValue =
      Number(amountSat) / (SATSPERBITCOIN / (fiatStats?.value || 65000));

    return {
      data: addressInfo,
      type: 'liquid',
      paymentNetwork: 'liquid',
      address: input?.address,
      paymentFee: paymentFee,
      supportFee: supportFee,
      webSocket,
      boltzData,
      sendAmount: !addressInfo.amount
        ? ''
        : `${
            masterInfoObject.userBalanceDenomination != 'fiat'
              ? `${amountSat}`
              : fiatValue < 0.01
              ? ''
              : `${fiatValue.toFixed(2)}`
          }`,
      canEditPayment: !addressInfo.isBip21,
    };
  } catch (err) {
    console.log('process liquid invoice error', err);
    webSocket?.close();
    throw new Error(err.message);
  }
}
