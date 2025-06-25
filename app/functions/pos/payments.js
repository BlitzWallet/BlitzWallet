// import {LIQUID_DEFAULT_FEE} from '../../constants';
// import {calculateBoltzFeeNew} from '../boltz/boltzFeeNew';
// import {
//   breezLiquidLNAddressPaymentWrapper,
//   breezLiquidPaymentWrapper,
// } from '../breezLiquid';
// import {getStoredProofs} from '../eCash/db';
// import {sumProofsValue} from '../eCash/proofs';
// import {getMeltQuote, payLnInvoiceFromEcash} from '../eCash/wallet';
// import formatBip21LiquidAddress from '../liquidWallet/formatBip21liquidAddress';
// import breezPaymentWrapperV2 from '../SDK/breezPaymentWrapperV2';
import {getLNAddressForLiquidPayment} from '../../components/admin/homeComponents/sendBitcoin/functions/payments';
// import breezLNAddressPaymentWrapperV2 from '../SDK/lightningAddressPaymentWrapperV2';
import {contactsLNtoLiquidSwapInfo} from '../../components/admin/homeComponents/contacts/internalComponents/LNtoLiquidSwap';
import {getBoltzWsUrl} from '../boltz/boltzEndpoitns';
import handleReverseClaimWSS from '../boltz/handle-reverse-claim-wss';
import {getPaymentaddressForBlitzUniqueName} from '../../../db';
import {sparkPaymenWrapper} from '../spark/payments';
import {decodeBip21Address} from '../bip21AddressFormmating';
import {parse} from 'react-native-svg';

// /**
//  * Pay to a Liquid address using the most efficient available payment method
// /**
//  * @param {Object} params - Payment parameters
//  * @param {Object} params.liquidNodeInformation - Information about the liquid node including balance
//  * @param {Object} params.nodeInformation - Information about the lightning node
//  * @param {string} params.address - Liquid address to pay to
//  * @param {Object} params.minMaxLiquidSwapAmounts - Min/max amounts for swaps
//  * @param {number} params.sendingAmountSats - Amount to send in satoshis
//  * @param {Object} params.masterInfoObject - Master information object
//  * @param {string} params.description - Payment description
//  * @returns {Promise<boolean>} - True if payment successful, false otherwise
//  */
// export async function payPOSLiquid({
//   liquidNodeInformation,
//   eCashBalance,
//   nodeInformation,
//   address, // liquid address
//   minMaxLiquidSwapAmounts,
//   sendingAmountSats,
//   masterInfoObject,
//   description,
//   webViewRef,
// }) {
//   try {
//     // Calculate fees for different payment methods
//     const lightningFee =
//       calculateBoltzFeeNew(
//         sendingAmountSats,
//         'ln-liquid',
//         minMaxLiquidSwapAmounts['reverseSwapStats'],
//       ) +
//       (sendingAmountSats * 0.005 + 4);
//     const liquidFee = LIQUID_DEFAULT_FEE;

//     // Log payment attempt
//     console.log(
//       `Attempting to pay ${sendingAmountSats} sats to Liquid address with fees: Liquid=${liquidFee}, Lightning=${lightningFee}`,
//     );

//     // 1. FIRST ATTEMPT: Pay with Liquid (most cost-efficient)
//     if (liquidNodeInformation.userBalance >= sendingAmountSats + liquidFee) {
//       console.log('Paying with Liquid - sufficient balance detected');
//       const formattedAddress = formatBip21LiquidAddress({
//         address,
//         amount: sendingAmountSats,
//         message: description,
//       });

//       // Check if this payment would nearly drain the wallet
//       const shouldDrain =
//         liquidNodeInformation.userBalance - sendingAmountSats - liquidFee < 10;

//       // Attempt Liquid payment
//       const paymentResponse = await breezLiquidPaymentWrapper({
//         invoice: formattedAddress,
//         paymentType: 'bip21Liquid',
//         shouldDrain: shouldDrain,
//       });

//       if (paymentResponse.didWork) {
//         console.log('Liquid payment successful');
//         return true;
//       }

//       console.log('Liquid payment failed, trying alternatives');

//       // If no alternative payment methods have sufficient balance, fail early
//       if (
//         masterInfoObject.enabledEcash &&
//         eCashBalance < sendingAmountSats + lightningFee &&
//         nodeInformation.userBalance < sendingAmountSats + lightningFee
//       ) {
//         console.log('Insufficient balance in all payment methods');
//         return false;
//       }
//     }

//     const {data, publicKey, privateKey, keys, preimage, liquidAddress} =
//       await contactsLNtoLiquidSwapInfo(address, sendingAmountSats, description);

//     if (!data?.invoice) throw new Error('No Invoice genereated');

//     const webSocket = new WebSocket(
//       `${getBoltzWsUrl(process.env.BOLTZ_ENVIRONMENT)}`,
//     );
//     const didHandle = await handleReverseClaimWSS({
//       ref: webViewRef,
//       webSocket: webSocket,
//       liquidAddress: liquidAddress,
//       swapInfo: data,
//       preimage: preimage,
//       privateKey: privateKey,
//     });
//     if (!didHandle) throw new Error('Unable to open websocket');

//     const invoice = data.invoice;

//     // 2. SECOND ATTEMPT: Pay with eCash if enabled
//     if (masterInfoObject.enabledEcash) {
//       console.log('Trying eCash payment');
//       try {
//         const storedProofs = await getStoredProofs();
//         const balance = sumProofsValue(storedProofs);

//         if (balance >= sendingAmountSats + lightningFee) {
//           // Must have invoice parameter for eCash payment
//           if (!invoice) {
//             console.warn('Missing invoice parameter for eCash payment');
//             throw new Error('Missing invoice for eCash payment');
//           }

//           const meltQuote = await getMeltQuote(invoice);
//           if (!meltQuote.quote)
//             throw new Error(
//               meltQuote.reason || 'Not able to generate eCash quote',
//             );

//           const didPay = await payLnInvoiceFromEcash({
//             quote: meltQuote.quote,
//             invoice,
//             proofsToUse: meltQuote.proofsToUse,
//             description,
//           });

//           if (!didPay.didWork) throw new Error(didPay.message);
//           console.log('eCash payment successful');
//           return true;
//         } else {
//           console.log('Insufficient eCash balance:', balance);
//         }
//       } catch (err) {
//         console.warn('eCash payment failed:', err.message);
//       }
//     }

//     // 3. LAST ATTEMPT: Pay with Lightning
//     if (nodeInformation.userBalance >= sendingAmountSats + lightningFee) {
//       console.log('Trying Lightning payment');
//       // Must have invoice parameter for Lightning payment
//       if (!invoice) {
//         console.warn('Missing invoice parameter for Lightning payment');
//         throw new Error('Missing invoice for Lightning payment');
//       }

//       const parsedInput = await parseInput(invoice);
//       const didPay = await breezPaymentWrapperV2({
//         paymentInfo: parsedInput,
//         paymentDescription: description,
//       });

//       if (didPay.didWork) {
//         console.log('Lightning payment successful');
//       } else {
//         console.log('Lightning payment failed');
//       }
//       return didPay.didWork;
//     }

//     // If we got here, all payment attempts failed
//     console.log('All payment methods failed or insufficient balance');

//     return false;
//   } catch (err) {
//     console.error('Payment error in payPOSLiquid:', err);
//     return false;
//   }
// }

/**
 * Pay to a Lightning address using the most efficient available payment method
/**
 * Pay to a Lightning address using the most efficient available payment method
 * @param {Object} params - Payment parameters
 * @param {string} params.LNURLAddress - Lightning address to pay to
 * @param {number} params.sendingAmountSats - Amount to send in satoshis
 * @param {Object} params.masterInfoObject - Master information object
 * @param {string} params.description - Payment description
 * @param {Object} params.sparkInformation - Information about the spark context including balance
 * @returns {Promise<boolean>} - True if payment successful, false otherwise
 */
export async function payPOSLNURL({
  LNURLAddress, // LNURL address
  sendingAmountSats,
  masterInfoObject,
  description,
  sparkInformation,
  // liquidNodeInformation,
  // nodeInformation,
  // minMaxLiquidSwapAmounts,
}) {
  try {
    // Parse the LNURL address first as it's needed for all payment methods
    const parsedInput = parse(LNURLAddress);
    const invoice = await getLNAddressForLiquidPayment(
      parsedInput,
      sendingAmountSats,
      description,
    );

    if (!invoice) throw new Error('Not able to get invoice');

    const feeResponse = await sparkPaymenWrapper({
      getFee: true,
      address: invoice,
      paymentType: 'lightning',
      amountSats: sendingAmountSats,
      masterInfoObject,
      fee: 0,
      description: '',
    });
    if (!feeResponse.didWork) throw new Error(feeResponse.error);

    if (sparkInformation.balance <= sendingAmountSats + feeResponse.fee)
      throw new Error('Insufficent balance');

    const paymentResponse = await sparkPaymenWrapper({
      address: invoice,
      paymentType: 'lightning',
      amountSats: sendingAmountSats,
      masterInfoObject,
      fee: feeResponse.fee,
      description,
    });

    if (!paymentResponse.didWork) throw new Error('Unable to send payment');

    return true;
    // // Calculate fees for different payment methods
    // const liquidFee =
    //   calculateBoltzFeeNew(
    //     sendingAmountSats,
    //     'liquid-ln',
    //     minMaxLiquidSwapAmounts['submarineSwapStats'],
    //   ) + LIQUID_DEFAULT_FEE;
    // const lightningFee = sendingAmountSats * 0.005 + 4;

    // console.log(
    //   `Attempting to pay ${sendingAmountSats} sats to Lightning address with fees: Lightning=${lightningFee}, Liquid=${liquidFee}`,
    // );

    // // Parse the LNURL address first as it's needed for all payment methods
    // const parsedInput = await parseInput(LNURLAddress);

    // // 1. FIRST ATTEMPT: Pay with Lightning (most cost-efficient for LNURL)
    // if (nodeInformation.userBalance >= sendingAmountSats + lightningFee) {
    //   console.log('Paying with Lightning - sufficient balance detected');
    //   const didPay = await breezLNAddressPaymentWrapperV2({
    //     sendingAmountSat: sendingAmountSats,
    //     paymentInfo: parsedInput,
    //     paymentDescription: description,
    //   });

    //   if (didPay.didWork) {
    //     console.log('Lightning payment successful');
    //     return true;
    //   }

    //   console.log('Lightning payment failed, trying alternatives');
    // }

    // // 2. SECOND ATTEMPT: Pay with eCash if enabled
    // if (masterInfoObject.enabledEcash) {
    //   console.log('Trying eCash payment');
    //   try {
    //     // Get Lightning invoice from LNURL
    //     const invoice = await getLNAddressForLiquidPayment(
    //       parsedInput,
    //       sendingAmountSats,
    //       description,
    //     );

    //     if (!invoice) throw new Error('Not able to get invoice');
    //     const storedProofs = await getStoredProofs();
    //     const balance = sumProofsValue(storedProofs);

    //     if (balance >= sendingAmountSats + lightningFee) {
    //       const meltQuote = await getMeltQuote(invoice);
    //       if (!meltQuote.quote)
    //         throw new Error(
    //           meltQuote.reason || 'Not able to generate eCash quote',
    //         );

    //       const didPay = await payLnInvoiceFromEcash({
    //         quote: meltQuote.quote,
    //         invoice,
    //         proofsToUse: meltQuote.proofsToUse,
    //         description,
    //       });

    //       if (!didPay.didWork) throw new Error(didPay.message);
    //       console.log('eCash payment successful');

    //       return true;
    //     } else {
    //       console.log('Insufficient eCash balance:', balance);
    //     }
    //   } catch (err) {
    //     console.warn('eCash payment failed:', err.message);
    //   }
    // }

    // // 3. LAST ATTEMPT: Pay with Liquid
    // if (liquidNodeInformation.userBalance >= sendingAmountSats + liquidFee) {
    //   console.log('Trying Liquid payment');
    //   // Check if this payment would nearly drain the wallet
    //   const shouldDrain =
    //     liquidNodeInformation.userBalance - sendingAmountSats - liquidFee < 10;

    //   const paymentResponse = await breezLiquidLNAddressPaymentWrapper({
    //     sendAmountSat: sendingAmountSats,
    //     description: description,
    //     paymentInfo: parsedInput.data,
    //     shouldDrain: shouldDrain,
    //   });

    //   if (paymentResponse.didWork) {
    //     console.log('Liquid payment successful');
    //   } else {
    //     console.log('Liquid payment failed');
    //   }

    //   return paymentResponse.didWork;
    // }

    // // If we got here, all payment attempts failed
    // console.log('All payment methods failed or insufficient balance');
    // return false;
  } catch (err) {
    console.error('Payment error in payPOSLNURL:', err);

    return false;
  }
}

/**
 * Pay to a contact using the most efficient available payment method
/**
 * @param {Object} params - Payment parameters
 * @param {Object} params.blitzContact - Information about the user you are paying
 * @param {number} params.sendingAmountSats - Amount to send in satoshis
 * @param {Object} params.masterInfoObject - Master information object
 * @param {string} params.description - Payment description
 * @param {Object} params.webViewRef - Referance to the global webview
 * @param {string} params.sparkInformation - Information about the current spark wallet context
 * @param {Object} params.minMaxLiquidSwapAmounts - Min/max amounts for swaps
 * @returns {Promise<boolean>} - True if payment successful, false otherwise
 */
export async function payPOSContact({
  blitzContact,
  sendingAmountSats,
  masterInfoObject,
  description,
  webViewRef,
  sparkInformation,
}) {
  try {
    const paymentAddressResponse = await getPaymentaddressForBlitzUniqueName(
      blitzContact,
      sendingAmountSats,
      description,
    );
    if (!paymentAddressResponse)
      throw new Error('Unable to retrive contact payment address');
    let {address: bip21Address, didUseSpark} = paymentAddressResponse;
    let {address} = decodeBip21Address(
      bip21Address,
      didUseSpark ? 'spark' : 'liquidnetwork',
    );

    if (!didUseSpark) {
      const {data, publicKey, privateKey, keys, preimage, liquidAddress} =
        await contactsLNtoLiquidSwapInfo(
          address,
          sendingAmountSats,
          description,
        );

      if (!data?.invoice) throw new Error('No Boltz invoice genereated');

      const webSocket = new WebSocket(
        `${getBoltzWsUrl(process.env.BOLTZ_ENVIRONMENT)}`,
      );
      const didHandle = await handleReverseClaimWSS({
        ref: webViewRef,
        webSocket: webSocket,
        liquidAddress: liquidAddress,
        swapInfo: data,
        preimage: preimage,
        privateKey: privateKey,
      });
      if (!didHandle) throw new Error('Unable to open websocket');

      address = data.invoice;
    }

    const feeResponse = await sparkPaymenWrapper({
      getFee: true,
      address: address,
      paymentType: didUseSpark ? 'spark' : 'lightning',
      amountSats: sendingAmountSats,
      masterInfoObject,
      fee: 0,
      description: '',
    });
    if (!feeResponse.didWork) throw new Error(feeResponse.error);

    if (sparkInformation.balance <= sendingAmountSats + feeResponse.fee)
      throw new Error('Insufficent balance');

    const paymentResponse = await sparkPaymenWrapper({
      address: address,
      paymentType: didUseSpark ? 'spark' : 'lightning',
      amountSats: sendingAmountSats,
      masterInfoObject,
      fee: feeResponse.fee,
      description,
    });

    if (!paymentResponse.didWork) throw new Error('Unable to send payment');

    return true;
  } catch (err) {
    console.error('Payment error in payPOSContact:', err);
    return false;
  }
}
