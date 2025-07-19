// import {payLnurl} from '@breeztech/react-native-breez-sdk';
// import {getLocalStorageItem} from '../localStorage';
// import {crashlyticsLogReport} from '../crashlyticsLogs';

// export default async function breezLNAddressPaymentWrapper({
//   sendingAmountSat,
//   paymentInfo,
//   confirmFunction,
//   failureFunction,
//   paymentDescription,
// }) {
//   let resposne;
//   try {
//     crashlyticsLogReport('Begining breez Lightning address payment function');
//     const useTrampoline =
//       JSON.parse(await getLocalStorageItem('useTrampoline')) ?? true;

//     console.log('USING TRAMPOLINE', useTrampoline);
//     const amountMsat = sendingAmountSat * 1000;

//     const optionalComment = paymentDescription;
//     const optionalPaymentLabel = paymentDescription;
//     resposne = await payLnurl({
//       data: paymentInfo.data,
//       amountMsat,
//       useTrampoline,
//       comment: optionalComment,
//       paymentLabel: optionalPaymentLabel,
//     });
//     console.log(resposne, 'LNURL PAY REPSONE');
//     if (resposne.type != 'endpointSuccess') throw Error('Payment Failed');
//     confirmFunction && confirmFunction(resposne);
//     return true;
//   } catch (err) {
//     console.log(err, 'LIGHTING ADDRESS PAYMENT EERRR');
//     failureFunction && failureFunction(resposne);
//     return false;
//   }
// }
