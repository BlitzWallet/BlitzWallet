// import {receivePayment} from '@breeztech/react-native-breez-sdk';
// import {calculateBoltzFeeNew} from '../boltz/boltzFeeNew';
// import {LIQUID_DEFAULT_FEE} from '../../constants';
// import {valueIsNotANumber} from './autoChannelRebalanceHelpers';
// import {
//   crashlyticsLogReport,
//   crashlyticsRecordErrorReport,
// } from '../crashlyticsLogs';

// export default async function autoOpenChannel({
//   masterInfoObject,
//   minMaxLiquidSwapAmounts,
//   channelOpenSizeSats,
// }) {
//   try {
//     if (!masterInfoObject.liquidWalletSettings.regulateChannelOpen)
//       return false;
//     const boltzFee = calculateBoltzFeeNew(
//       channelOpenSizeSats,
//       'liquid-ln',
//       minMaxLiquidSwapAmounts.submarineSwapStats,
//     );
//     const fee = boltzFee * 2 + LIQUID_DEFAULT_FEE;
//     const invoiceAmountSat = channelOpenSizeSats - fee;
//     if (valueIsNotANumber(invoiceAmountSat)) return false;

//     crashlyticsLogReport('Begining receive payment');
//     const invoice = await receivePayment({
//       amountMsat: invoiceAmountSat * 1000,
//       description: 'Auto Channel Open',
//     });

//     let maxChannelOpenFee =
//       masterInfoObject.liquidWalletSettings?.maxChannelOpenFee || 5000; //for legacy users that might not have changed liquid seetings page
//     const channelCostSat = invoice.openingFeeMsat / 1000 || 0;

//     if (maxChannelOpenFee < channelCostSat) return false;

//     if (invoice?.lnInvoice?.bolt11) {
//       return {
//         type: 'submarineSwap',
//         for: 'autoChannelOpen',
//         didRun: true,
//         isEcash: false,
//         invoice,
//       };
//     } else return false;
//   } catch (err) {
//     console.log(err, 'in auto open');
//     crashlyticsRecordErrorReport(err.message);
//     return false;
//   }
// }
