// import {
//   FeeratePreset,
//   fetchReverseSwapFees,
//   onchainPaymentLimits,
//   payOnchain,
//   prepareOnchainPayment,
//   SwapAmountType,
// } from '@breeztech/react-native-breez-sdk';
// import {getMempoolReccomenededFee} from '../getMempoolFeeRates';
// import {
//   crashlyticsLogReport,
//   crashlyticsRecordErrorReport,
// } from '../crashlyticsLogs';

// export default async function breezLNOnchainPaymentWrapper({
//   amountSat,
//   onlyPrepare,
//   paymentInfo,
// }) {
//   try {
//     crashlyticsLogReport('Starting breez Lightning onchain payment function');
//     const [currentLimits, satPerVbyte] = await Promise.all([
//       onchainPaymentLimits(),
//       getMempoolReccomenededFee(),
//     ]);

//     console.log(`Minimum amount, in sats: ${currentLimits.minSat}`);
//     console.log(`Maximum amount, in sats: ${currentLimits.maxSat}`);

//     if (currentLimits.minSat > amountSat)
//       return {
//         didWork: false,
//         error: `Minimum amount, in sats: ${currentLimits.minSat}`,
//       };
//     if (currentLimits.maxSat < amountSat)
//       return {
//         didWork: false,
//         error: `Maximum amount, in sats: ${currentLimits.maxSat}`,
//       };

//     const prepareResponse = await prepareOnchainPayment({
//       amountSat: paymentInfo.data.shouldDrain
//         ? currentLimits.maxSat
//         : amountSat,
//       amountType: paymentInfo.data.shouldDrain
//         ? SwapAmountType.SEND
//         : SwapAmountType.RECEIVE,
//       claimTxFeerate: satPerVbyte || 10,
//     });
//     console.log(`Sender amount: ${prepareResponse.senderAmountSat} sats`);
//     console.log(`Recipient amount: ${prepareResponse.recipientAmountSat} sats`);
//     console.log(`Total fees: ${prepareResponse.totalFees} sats`);

//     if (onlyPrepare) {
//       return {didWork: true, fees: prepareResponse.totalFees};
//     }

//     const destinationAddress = paymentInfo?.data.address;
//     const reverseSwapInfo = await payOnchain({
//       recipientAddress: destinationAddress,
//       prepareRes: prepareResponse,
//     });
//     console.log(reverseSwapInfo.reverseSwapInfo);

//     return {
//       didWork: true,
//       fees: prepareResponse.totalFees,
//       amount: reverseSwapInfo.reverseSwapInfo.onchainAmountSat,
//     };
//   } catch (err) {
//     console.error(err);
//     crashlyticsRecordErrorReport(err.message);
//     return {didWork: false, error: JSON.stringify(err)};
//   }
// }
