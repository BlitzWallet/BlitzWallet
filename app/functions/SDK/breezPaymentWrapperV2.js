// import {
//   PaymentStatus,
//   reportIssue,
//   ReportIssueRequestVariant,
//   sendPayment,
// } from '@breeztech/react-native-breez-sdk';
// import {getLocalStorageItem} from '../localStorage';
// import {crashlyticsLogReport} from '../crashlyticsLogs';

// export default async function breezPaymentWrapperV2({
//   paymentInfo,
//   amountMsat,
//   paymentDescription = '',
// }) {
//   let response;
//   try {
//     crashlyticsLogReport('Begining breez Lightning payment V2 function');
//     const useTrampoline =
//       JSON.parse(await getLocalStorageItem('useTrampoline')) ?? true;

//     console.log('USING TRAMPOLINE', useTrampoline);

//     response = !!paymentInfo?.invoice?.amountMsat
//       ? await sendPayment({
//           useTrampoline: useTrampoline,
//           bolt11: paymentInfo?.invoice?.bolt11,
//           label: paymentDescription || undefined,
//         })
//       : await sendPayment({
//           useTrampoline: useTrampoline,
//           bolt11: paymentInfo?.invoice?.bolt11,
//           amountMsat,
//           label: paymentDescription || undefined,
//         });
//     if (
//       !!response.payment.error &&
//       response.payment.status === PaymentStatus.FAILED
//     )
//       throw new Error(String(response.payment.error));
//     return {didWork: true, response};
//   } catch (err) {
//     console.log(err.message, 'PAYMENT FAILURE ERRROR');
//     console.log(response, 'PAYMENT RESPONSE ERRROR');
//     try {
//       const paymentHash = paymentInfo.invoice.paymentHash;
//       await reportIssue({
//         type: ReportIssueRequestVariant.PAYMENT_FAILURE,
//         data: {paymentHash},
//       });
//     } catch (error) {
//       console.log(error);
//     } finally {
//       return {didWork: false, response: {...response, reason: err.message}};
//     }
//   }
// }
