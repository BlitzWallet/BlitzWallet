// import {receivePayment} from '@breeztech/react-native-breez-sdk';
// import autoOpenChannel from './autoOpenChannel';
// import {breezLiquidReceivePaymentWrapper} from '../breezLiquid';
// import {LIQUIDAMOUTBUFFER} from '../../constants/math';
// import {calculateBoltzFeeNew} from '../boltz/boltzFeeNew';
// import {LIQUID_DEFAULT_FEE, MIN_CHANNEL_OPEN_FEE} from '../../constants';
// import {valueIsNotANumber} from './autoChannelRebalanceHelpers';
// import {
//   crashlyticsLogReport,
//   crashlyticsRecordErrorReport,
// } from '../crashlyticsLogs';

// export default async function autoChannelRebalance({
//   nodeInformation,
//   liquidNodeInformation,
//   masterInfoObject,
//   // eCashBalance,
//   minMaxLiquidSwapAmounts,
// }) {
//   const node_information = nodeInformation;
//   const liquid_information = liquidNodeInformation;
//   console.log(
//     liquid_information.userBalance,
//     'LIQUID BLANCE',
//     nodeInformation.userBalance,
//   );
//   const channelOpenSizeSats =
//     masterInfoObject.liquidWalletSettings.regulatedChannelOpenSize ||
//     MIN_CHANNEL_OPEN_FEE;
//   const minAutoSwapAmountSats =
//     masterInfoObject.liquidWalletSettings.minAutoSwapAmount || 10000;
//   const autoChannelRebalancePercantage =
//     masterInfoObject.liquidWalletSettings.autoChannelRebalancePercantage || 90;
//   // if (eCashBalance > 5000) {
//   //   console.log('RUNNIN IN ECASH AUTO CHANNEL REBALANCE');

//   //   try {
//   //     const sendAmountSat = eCashBalance - 1000;
//   //     if (valueIsNotANumber(sendAmountSat)) return {didRun: false};

//   //     const response = await breezLiquidReceivePaymentWrapper({
//   //       sendAmount: Number(sendAmountSat),
//   //       paymentType: 'lightning',
//   //       description: 'Auto Channel Rebalance',
//   //     });
//   //     if (!response) return {didRun: false};
//   //     const {destination} = response;

//   //     return {
//   //       type: 'reverseSwap',
//   //       for: 'autoChannelRebalance',
//   //       didRun: true,
//   //       isEcash: true,
//   //       invoice: destination,
//   //     };
//   //   } catch (err) {
//   //     console.log(err);
//   //     return {didRun: false};
//   //   }
//   // }

//   if (!masterInfoObject.liquidWalletSettings.isLightningEnabled)
//     return {didRun: false};

//   if (
//     node_information.userBalance <= 0 ||
//     liquid_information.userBalance >= channelOpenSizeSats
//   ) {
//     console.log('REGULATING');

//     if (liquid_information.userBalance < channelOpenSizeSats)
//       return {didRun: false};
//     crashlyticsLogReport('Running auto channel rebalance channel open');
//     const autoChannelInfo = await autoOpenChannel({
//       masterInfoObject,
//       minMaxLiquidSwapAmounts,
//       channelOpenSizeSats,
//     });

//     console.log(autoChannelInfo, 'AUTO OPEN CHANNEL');

//     if (!autoChannelInfo) {
//       return {didRun: false};
//     }

//     return autoChannelInfo;
//   }
//   if (
//     !masterInfoObject.liquidWalletSettings.autoChannelRebalance ||
//     !Object.keys(nodeInformation).length
//   )
//     return {didRun: false};

//   const lightningBalance = node_information.userBalance;
//   const lightningInboundLiquidity =
//     node_information.inboundLiquidityMsat / 1000;
//   const targetPercentage = autoChannelRebalancePercantage;
//   const liquidBalance = liquid_information.userBalance;

//   const totalLightningAmount = lightningBalance + lightningInboundLiquidity;

//   const currentChannelBalancePercentage =
//     totalLightningAmount === 0
//       ? 0
//       : Math.round((lightningBalance / totalLightningAmount) * 100);

//   const offFromTargetPercentage = Math.abs(
//     currentChannelBalancePercentage - targetPercentage,
//   );

//   const offFromTargetSatAmount = Math.round(
//     totalLightningAmount * (offFromTargetPercentage / 100),
//   );

//   console.log(
//     offFromTargetSatAmount, //5,449,778
//     lightningBalance, //37,920.261
//     lightningInboundLiquidity, //64,905.739
//     targetPercentage, //90
//     totalLightningAmount, //102,826
//     currentChannelBalancePercentage, //37
//     offFromTargetPercentage, //53
//     'SAT AMOUNT', //SAT AMOUNT
//     liquidBalance,
//   );

//   if (
//     valueIsNotANumber(lightningBalance) ||
//     valueIsNotANumber(lightningInboundLiquidity) ||
//     valueIsNotANumber(currentChannelBalancePercentage) ||
//     valueIsNotANumber(targetPercentage) ||
//     valueIsNotANumber(offFromTargetSatAmount) ||
//     valueIsNotANumber(offFromTargetPercentage) ||
//     valueIsNotANumber(liquidBalance)
//   )
//     return {
//       didRun: false,
//     };

//   if (offFromTargetSatAmount < totalLightningAmount * 0.05) {
//     console.log('5% buffer block');
//     //gives a 5% buffer
//     return {
//       didRun: false,
//     };
//   }

//   crashlyticsLogReport('Trying to auto channel rebalance');
//   if (currentChannelBalancePercentage > targetPercentage) {
//     const sendAmount =
//       offFromTargetSatAmount > lightningBalance
//         ? lightningBalance
//         : offFromTargetSatAmount;
//     const lnFee = Math.round(sendAmount * 0.005) + 10;
//     const actualSendAmount =
//       offFromTargetSatAmount > lightningBalance
//         ? Math.max(0, lightningBalance - lnFee)
//         : Math.max(0, offFromTargetSatAmount - lnFee);

//     if (
//       actualSendAmount < Number(minAutoSwapAmountSats) ||
//       actualSendAmount < minMaxLiquidSwapAmounts.min
//     ) {
//       // only allows auto swaps that are greater than the minimum liimit set run
//       return {
//         didRun: false,
//       };
//     }
//     crashlyticsLogReport('Starting breeze liquid receive payment');
//     const response = await breezLiquidReceivePaymentWrapper({
//       sendAmount: Number(actualSendAmount),
//       paymentType: 'lightning',
//       description: 'Auto Channel Rebalance',
//     });
//     if (!response) return {didRun: false};
//     const {destination} = response;
//     return {
//       type: 'reverseSwap',
//       for: 'autoChannelRebalance',
//       didRun: true,
//       isEcash: false,
//       invoice: destination,
//     };
//   } else {
//     if (liquidBalance < 1500) return {didRun: false};
//     try {
//       const sendAmount =
//         offFromTargetSatAmount > liquidBalance
//           ? liquidBalance
//           : offFromTargetSatAmount;
//       const boltzFee = calculateBoltzFeeNew(
//         sendAmount,
//         'liquid-ln',
//         minMaxLiquidSwapAmounts.submarineSwapStats,
//       );
//       const fee = boltzFee * 1.5 + LIQUID_DEFAULT_FEE;
//       const actualSendAmount =
//         offFromTargetSatAmount > liquidBalance
//           ? Math.max(0, liquidBalance - fee)
//           : Math.max(0, offFromTargetSatAmount - fee);
//       console.log(actualSendAmount, 'ACTUAL SEND AMOUNT');
//       if (
//         actualSendAmount < Number(minAutoSwapAmountSats) ||
//         actualSendAmount < minMaxLiquidSwapAmounts.min
//       ) {
//         // only allows auto swaps that are greater than the minimum liimit set run
//         return {
//           didRun: false,
//         };
//       }
//       crashlyticsLogReport('Starting breeze lightning receive payment');
//       const invoice = await receivePayment({
//         amountMsat: actualSendAmount * 1000,
//         description: 'Auto Channel Rebalance',
//       });
//       if (!invoice || invoice.openingFeeMsat) {
//         return {didRun: false};
//       }
//       return {
//         type: 'submarineSwap',
//         for: 'autoChannelRebalance',
//         didRun: true,
//         isEcash: false,
//         invoice: invoice,
//       };
//     } catch (err) {
//       console.log('AUTO CHANNEL REBALANCE ERR', err);
//       crashlyticsRecordErrorReport(err.message);
//       return {
//         swapInfo: {},
//         privateKey: '',
//         invoice: '',
//         didRun: false,
//         type: '',
//         for: '',
//       };
//     }
//   }
// }
