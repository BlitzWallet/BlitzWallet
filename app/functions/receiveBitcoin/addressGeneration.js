import {
  BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
  SATSPERBITCOIN,
} from '../../constants';
import {breezLiquidReceivePaymentWrapper} from '../breezLiquid';

import customUUID from '../customUUID';
import {crashlyticsLogReport} from '../crashlyticsLogs';
import {sparkReceivePaymentWrapper} from '../spark/payments';
import * as bip21 from 'bip21';

let invoiceTracker = [];
export async function initializeAddressProcess(wolletInfo) {
  const {setAddressState, selectedRecieveOption} = wolletInfo;
  const requestUUID = customUUID();
  invoiceTracker.push(requestUUID);
  let stateTracker = {};
  let hasGlobalError = false;
  try {
    crashlyticsLogReport(
      `Running address geneartion functinon for: ${selectedRecieveOption} with ${JSON.stringify(
        wolletInfo,
      )}`,
    );
    setAddressState(prev => {
      return {
        ...prev,
        isGeneratingInvoice: true,
        generatedAddress: '',
        errorMessageText: {
          type: null,
          text: '',
        },
        swapPegInfo: {},
        isReceivingSwap: false,
        hasGlobalError: false,
      };
    });
    if (selectedRecieveOption.toLowerCase() === 'lightning') {
      const response = await sparkReceivePaymentWrapper({
        paymentType: 'lightning',
        amountSats: wolletInfo.receivingAmount,
        memo: wolletInfo.description,
      });
      // const response = await generateLightningAddress(wolletInfo);
      if (!response.didWork) throw new Error('Error with lightning');
      stateTracker = {
        generatedAddress: response.invoice,
        fee: 0,
      };
      // stateTracker = response
    } else if (selectedRecieveOption.toLowerCase() === 'bitcoin') {
      const response = await sparkReceivePaymentWrapper({
        paymentType: 'bitcoin',
        amountSats: wolletInfo.receivingAmount,
        memo: wolletInfo.description,
      });
      // const response = await generateBitcoinAddress(wolletInfo);
      if (!response.didWork) throw new Error('Error with bitcoin');
      stateTracker = {
        generatedAddress: response.invoice,
        fee: 0,
      };
      // stateTracker = response;
    } else if (selectedRecieveOption.toLowerCase() === 'spark') {
      const response = await sparkReceivePaymentWrapper({
        paymentType: 'spark',
        amountSats: wolletInfo.receivingAmount,
        memo: wolletInfo.description,
      });
      // const response = await generateBitcoinAddress(wolletInfo);
      if (!response.didWork) throw new Error('Error with spark');
      stateTracker = {
        generatedAddress: response.invoice,
        fee: 0,
      };
    } else {
      const response = await generateLiquidAddress(wolletInfo);
      if (!response) throw new Error('Error with bitcoin');
      stateTracker = response;
    }
  } catch (error) {
    console.log(error, 'HANDLING ERROR');
    stateTracker = {
      generatedAddress: null,
      errorMessageText: {
        type: 'stop',
        text: error.message,
      },
    };
  } finally {
    if (invoiceTracker.length > 3) invoiceTracker = [invoiceTracker.pop()];
    if (invoiceTracker[invoiceTracker.length - 1] != requestUUID) return;
    if (hasGlobalError) {
      setAddressState(prev => {
        return {
          ...prev,
          hasGlobalError: true,
          isGeneratingInvoice: false,
        };
      });
    } else {
      setAddressState(prev => {
        return {
          ...prev,
          ...stateTracker,
          isGeneratingInvoice: false,
        };
      });
    }
  }
}

// async function generateLightningAddress(wolletInfo) {
//   const {
//     receivingAmount,
//     description,
//     userBalanceDenomination,
//     nodeInformation,
//     masterInfoObject,
//     setAddressState,
//     minMaxSwapAmounts,
//     mintURL,
//     eCashBalance,
//   } = wolletInfo;
//   const liquidWalletSettings = masterInfoObject.liquidWalletSettings;
//   const eCashSettings = masterInfoObject.ecashWalletSettings;
//   const hasLightningChannel = !!nodeInformation.userBalance;
//   const enabledEcash = masterInfoObject.enabledEcash;
//   const isInBetweenLiquidReceiveAmounts =
//     receivingAmount >= minMaxSwapAmounts.min &&
//     receivingAmount <= minMaxSwapAmounts.max;
//   // At this ponint we have three receive options, LN -> Liquid, Ecash, LN
//   // We will first try to see if we can use ecash
//   // if lightning is not enabled or a user does not have a channel and ecash is enabled and the receiving amount is less than boltz min swap amount use ecash
//   if (
//     (!liquidWalletSettings.isLightningEnabled || !hasLightningChannel) &&
//     enabledEcash &&
//     receivingAmount <= eCashSettings?.maxReceiveAmountSat //customaizable amount in ecash settings
//   ) {
//     if (eCashSettings.maxEcashBalance >= receivingAmount + eCashBalance) {
//       const eCashInvoice = await getECashInvoice({
//         amount: receivingAmount,
//         mintURL: mintURL,
//         descriptoin: description,
//       });

//       if (eCashInvoice.didWork) {
//         ecashEventEmitter.emit(ECASH_QUOTE_EVENT_NAME, {
//           quote: eCashInvoice.mintQuote.quote,
//           mintURL: eCashInvoice.mintURL,
//         });
//         return {
//           fee: 0,
//           generatedAddress: eCashInvoice.mintQuote.request,
//         };
//       } else {
//         return {
//           generatedAddress: null,
//           errorMessageText: {
//             type: 'stop',
//             text: eCashInvoice.reason || 'Error generating eCash invoice',
//           },
//         };
//       }
//     } else if (receivingAmount >= minMaxSwapAmounts.min) {
//       const resposne = await lnToLiquidInvoiceDetails({
//         receivingAmount,
//         description,
//       });
//       return {
//         ...resposne,
//         errorMessageText: {
//           type: 'warning',
//           text: 'Your eCash wallet has reached its maximum balance. This payment will be swapped to the bank.',
//         },
//       };
//     } else {
//       return {
//         generatedAddress: null,
//         errorMessageText: {
//           showButton: true,
//           type: 'stop',
//           text: `Your eCash wallet has reached its maximum balance, and the current receive amount is below the minimum swap limit of ${displayCorrectDenomination(
//             {
//               amount: minMaxSwapAmounts.min,
//               nodeInformation,
//               masterInfoObject: {
//                 userBalanceDenomination: userBalanceDenomination,
//               },
//             },
//           )}.`,
//         },
//       };
//     }
//   }

//   // Now the only posible options are LN -> liquid swaps or LN.

//   // if lightning is not enabled and ecash also must not be enabled and the minimum requested amount is less than boltz minimum we need to force an error since we cannot receive this payment
//   if (
//     !liquidWalletSettings.isLightningEnabled &&
//     receivingAmount < minMaxSwapAmounts.min
//   ) {
//     return {
//       errorMessageText: {
//         type: 'stop',
//         text: `The minimum receive amount is ${displayCorrectDenomination({
//           amount: minMaxSwapAmounts.min,
//           nodeInformation,
//           masterInfoObject: {
//             userBalanceDenomination: userBalanceDenomination,
//           },
//         })}, but ${displayCorrectDenomination({
//           amount: receivingAmount,
//           nodeInformation,
//           masterInfoObject: {
//             userBalanceDenomination: userBalanceDenomination,
//           },
//         })} was requested.`,
//       },
//     };
//   }

//   // If Ln is not enabled use liquid and we know we can use liquid since we just checked the min amoutn in the last statement
//   if (
//     !liquidWalletSettings.isLightningEnabled &&
//     isInBetweenLiquidReceiveAmounts
//   ) {
//     const resposne = await lnToLiquidInvoiceDetails({
//       receivingAmount,
//       description,
//     });
//     return {
//       ...resposne,
//     };
//   }

//   // At this point we know that lightning is enabled

//   // If lightning is enabled, but a user does not have a channel open and they have set for blitz wallet to automaticly manage the channel open process and the receive amount is less than thier set channel open amount then use liquid
//   if (
//     !hasLightningChannel &&
//     liquidWalletSettings.regulateChannelOpen &&
//     liquidWalletSettings.regulatedChannelOpenSize > receivingAmount &&
//     isInBetweenLiquidReceiveAmounts
//   ) {
//     const resposne = await lnToLiquidInvoiceDetails({
//       receivingAmount,
//       description,
//     });
//     return {
//       ...resposne,
//     };
//   }

//   // if lightning is enabled and a user has a lightning channel but thier inbound liquidity is less than the receiving amount and they have set for blitz to regulate the channnel open process and the receiving amount is less than the regulated channel open amount use liqid
//   if (
//     hasLightningChannel &&
//     nodeInformation.inboundLiquidityMsat / 1000 - LIGHTNINGAMOUNTBUFFER <=
//       receivingAmount &&
//     liquidWalletSettings.regulateChannelOpen &&
//     liquidWalletSettings.regulatedChannelOpenSize > receivingAmount &&
//     isInBetweenLiquidReceiveAmounts
//   ) {
//     const resposne = await lnToLiquidInvoiceDetails({
//       receivingAmount,
//       description,
//     });
//     return {
//       ...resposne,
//     };
//   }
//   // At this point all of the base use cases for liquid swaps are used and we now should generate a lightning invoice
//   const openChannelFees = await openChannelFee({
//     amountMsat: receivingAmount * 1000,
//   });

//   // If the user has lightning enabled and the current lightiing fee is grater than the max channel open fee they have set in settings and they have regulated channel open on then use liquid
//   if (
//     openChannelFees.feeMsat / 1000 >= liquidWalletSettings.maxChannelOpenFee &&
//     liquidWalletSettings.regulateChannelOpen &&
//     isInBetweenLiquidReceiveAmounts
//   ) {
//     const resposne = await lnToLiquidInvoiceDetails({
//       receivingAmount,
//       description,
//     });
//     return {
//       ...resposne,
//     };
//   }
//   if (receivingAmount * 1000 < openChannelFees.feeMsat) {
//     return {
//       generatedAddress: null,
//       fee: openChannelFees.feeMsat / 1000,
//       errorMessageText: {
//         type: 'stop',
//         text: `The payment must be more than ${displayCorrectDenomination({
//           amount: openChannelFees.feeMsat / 1000,
//           nodeInformation,
//           masterInfoObject: {
//             userBalanceDenomination: userBalanceDenomination,
//           },
//         })}, but only ${displayCorrectDenomination({
//           amount: receivingAmount,
//           nodeInformation,
//           masterInfoObject: {
//             userBalanceDenomination: userBalanceDenomination,
//           },
//         })} was requested.`,
//       },
//     };
//   }
//   const invoice = await receivePayment({
//     amountMsat: receivingAmount * 1000,
//     description: description || BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
//   });
//   // if the current lightning invoice has a channel open fee give a wanring to the user so they know what is happening
//   if (invoice.openingFeeMsat) {
//     return {
//       generatedAddress: invoice.lnInvoice.bolt11,
//       fee: invoice.openingFeeMsat / 1000,
//       errorMessageText: {
//         type: 'warning',
//         text: `A ${displayCorrectDenomination({
//           amount: invoice.openingFeeMsat / 1000,
//           nodeInformation,
//           masterInfoObject: {
//             userBalanceDenomination: userBalanceDenomination,
//           },
//         })} fee will be applied.`,
//       },
//     };
//   }

//   return {
//     generatedAddress: invoice.lnInvoice.bolt11,
//     fee: invoice.openingFeeMsat / 1000,
//   };
// }

async function generateLiquidAddress(wolletInfo) {
  const {receivingAmount, setAddressState, description} = wolletInfo;

  const addressResponse = await breezLiquidReceivePaymentWrapper({
    sendAmount: receivingAmount,
    paymentType: 'liquid',
    description: description || BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
  });
  if (!addressResponse) {
    return {
      generatedAddress: null,
      errorMessageText: {
        type: 'stop',
        text: `Unable to generate liquid address`,
      },
    };
  }

  const {destination, receiveFeesSat} = addressResponse;

  return {
    generatedAddress: destination,
    fee: receiveFeesSat,
  };
}

// async function generateBitcoinAddress(wolletInfo) {
//   const {
//     setAddressState,
//     receivingAmount,
//     userBalanceDenomination,
//     nodeInformation,
//   } = wolletInfo;
//   // Fetch the Onchain lightning limits
//   const [currentLimits, addressResponse] = await Promise.all([
//     fetchOnchainLimits(),
//     breezLiquidReceivePaymentWrapper({
//       paymentType: 'bitcoin',
//       sendAmount: receivingAmount,
//     }),
//   ]);

//   console.log(`Minimum amount, in sats: ${currentLimits.receive.minSat}`);
//   console.log(`Maximum amount, in sats: ${currentLimits.receive.maxSat}`);

//   if (!addressResponse) {
//     return {
//       generatedAddress: null,
//       errorMessageText: {
//         type: 'stop',
//         text: `Output amount is ${
//           currentLimits.receive.minSat > receivingAmount
//             ? 'below minimum ' +
//               displayCorrectDenomination({
//                 amount: currentLimits.receive.minSat,
//                 nodeInformation,
//                 masterInfoObject: {
//                   userBalanceDenomination: userBalanceDenomination,
//                 },
//               })
//             : 'above maximum ' +
//               displayCorrectDenomination({
//                 amount: currentLimits.receive.maxSat,
//                 nodeInformation,
//                 masterInfoObject: {
//                   userBalanceDenomination: userBalanceDenomination,
//                 },
//               })
//         }`,
//       },
//       minMaxSwapAmount: {
//         min: currentLimits.receive.minSat,
//         max: currentLimits.receive.maxSat,
//       },
//     };
//   }
//   const {destination, receiveFeesSat} = addressResponse;

//   return {
//     generatedAddress: destination,
//     fee: receiveFeesSat,
//   };
// }
