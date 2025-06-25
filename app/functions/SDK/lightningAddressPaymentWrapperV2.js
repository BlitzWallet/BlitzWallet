// import {payLnurl} from '@breeztech/react-native-breez-sdk';
// import {getLocalStorageItem} from '../localStorage';
// import {crashlyticsLogReport} from '../crashlyticsLogs';

// export default async function breezLNAddressPaymentWrapperV2({
//   sendingAmountSat,
//   paymentInfo,
//   paymentDescription,
// }) {
//   let resposne;
//   try {
//     crashlyticsLogReport(
//       'Begining breez Lightning address V2 payment function',
//     );
//     const useTrampoline =
//       JSON.parse(await getLocalStorageItem('useTrampoline')) ?? true;

//     console.log('USING TRAMPOLINE', useTrampoline);
//     const amountMsat = sendingAmountSat * 1000;

//     const optionalComment = paymentDescription || undefined;
//     const optionalPaymentLabel = paymentDescription || undefined;
//     resposne = await payLnurl({
//       data: paymentInfo.data,
//       amountMsat,
//       useTrampoline,
//       comment: optionalComment,
//       paymentLabel: optionalPaymentLabel,
//     });
//     console.log(resposne, 'LNURL PAY REPSONE');
//     if (resposne.type != 'endpointSuccess') throw Error('Payment Failed');
//     return {didWork: true, resposne};
//   } catch (err) {
//     console.log(err, 'LIGHTING ADDRESS PAYMENT EERRR');
//     return {didWork: false, resposne};
//   }
// }
