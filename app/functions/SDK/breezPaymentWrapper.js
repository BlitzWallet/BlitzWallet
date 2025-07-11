// import {
//   PaymentStatus,
//   reportIssue,
//   ReportIssueRequestVariant,
//   sendPayment,
// } from '@breeztech/react-native-breez-sdk';
// import {getLocalStorageItem} from '../localStorage';
// import {crashlyticsLogReport} from '../crashlyticsLogs';

// export default async function breezPaymentWrapper({
//   paymentInfo,
//   amountMsat,
//   confirmFunction,
//   failureFunction,
//   paymentDescription,
// }) {
//   let resposne;
//   try {
//     crashlyticsLogReport('Begining breez Lightning payment function');
//     const useTrampoline =
//       JSON.parse(await getLocalStorageItem('useTrampoline')) ?? true;

//     console.log('USING TRAMPOLINE', useTrampoline);

//     resposne = !!paymentInfo?.invoice?.amountMsat
//       ? await sendPayment({
//           useTrampoline: useTrampoline,
//           bolt11: paymentInfo?.invoice?.bolt11,
//           label: paymentDescription || '',
//         })
//       : await sendPayment({
//           useTrampoline: useTrampoline,
//           bolt11: paymentInfo?.invoice?.bolt11,
//           amountMsat,
//           label: paymentDescription || '',
//         });
//     if (
//       !!resposne.payment.error &&
//       resposne.payment.status === PaymentStatus.FAILED
//     )
//       throw Error(String(resposne.payment.error));
//     confirmFunction && confirmFunction(resposne);
//     return true;
//   } catch (err) {
//     console.log(err, 'PAYMENT FAILURE ERRROR');
//     console.log(resposne, 'PAYMENT RESPONSE ERRROR');
//     try {
//       const paymentHash = paymentInfo.invoice.paymentHash;
//       await reportIssue({
//         type: ReportIssueRequestVariant.PAYMENT_FAILURE,
//         data: {paymentHash},
//       });
//     } catch (error) {
//       console.log(error);
//     } finally {
//       failureFunction && failureFunction({reason: err});
//     }
//     return false;
//   }
// }
