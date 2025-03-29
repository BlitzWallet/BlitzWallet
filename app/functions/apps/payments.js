import {parseInput} from '@breeztech/react-native-breez-sdk';
import {LIQUID_DEFAULT_FEE} from '../../constants';
import {calculateBoltzFeeNew} from '../boltz/boltzFeeNew';
import {breezLiquidPaymentWrapper} from '../breezLiquid';
import {getMeltQuote, payLnInvoiceFromEcash} from '../eCash/wallet';
import {getStoredProofs} from '../eCash/db';
import {sumProofsValue} from '../eCash/proofs';
import breezPaymentWrapperV2 from '../SDK/breezPaymentWrapperV2';

export default async function sendStorePayment({
  liquidNodeInformation,
  nodeInformation,
  invoice, // Bolt11 invoice
  payingStateUpdate,
  minMaxLiquidSwapAmounts,
  sendingAmountSats,
  masterInfoObject,
  description = '',
}) {
  try {
    const liquidFee =
      calculateBoltzFeeNew(
        sendingAmountSats,
        'liquid-ln',
        minMaxLiquidSwapAmounts['submarineSwapStats'],
      ) + LIQUID_DEFAULT_FEE;
    const lightningFee = sendingAmountSats * 0.005 + 4;

    // Try to pay with eCash
    if (masterInfoObject.enabledEcash) {
      console.log('Paying with ecash....');
      try {
        const storedProofs = await getStoredProofs();
        const balance = sumProofsValue(storedProofs);
        if (balance > sendingAmountSats + lightningFee) {
          const meltQuote = await getMeltQuote(invoice);
          if (!meltQuote.quote)
            throw new Error(
              meltQuote.reason || 'Not able to generate ecash quote',
            );
          const didPay = await payLnInvoiceFromEcash({
            quote: meltQuote.quote,
            invoice,
            proofsToUse: meltQuote.proofsToUse,
            description: description,
          });
          if (!didPay.didWork) throw new Error(didPay.message);
          return {
            didWork: true,
            response: {
              feeSat: didPay.txObject.fee,
              amountSat: didPay.txObject.amount,
              status: 'complete',
              details: {error: ''},
            },
            formattingType: 'ecash',
          };
        }
      } catch (err) {
        console.warn('eCash payment failed:', err.message);
      }
    }

    // Try to pay with Liquid
    if (
      liquidNodeInformation.userBalance > sendingAmountSats + liquidFee &&
      sendingAmountSats > minMaxLiquidSwapAmounts.min
    ) {
      console.log('Paying with liquid....');
      const paymentResponse = await breezLiquidPaymentWrapper({
        invoice: invoice,
        paymentType: 'bolt11',
      });

      if (!paymentResponse.didWork)
        throw new Error('Error occurred when paying invoice.');

      return {
        didWork: true,
        response: paymentResponse.payment,
        formattingType: 'liquidNode',
      };
    }

    // Try to pay with Lightning
    if (
      masterInfoObject.liquidWalletSettings.isLightningEnabled &&
      nodeInformation.userBalance > sendingAmountSats + lightningFee
    ) {
      console.log('Paying with lightning....');
      const parsedLnInvoice = await parseInput(invoice);
      const paymentResponse = await breezPaymentWrapperV2({
        paymentInfo: parsedLnInvoice,
        amountMsat: parsedLnInvoice?.invoice?.amountMsat,
        paymentDescription: description,
      });

      if (!paymentResponse.didWork)
        throw new Error('Error occurred when paying invoice.');
      return {
        didWork: true,
        response: paymentResponse.response,
        formattingType: 'lightningNode',
      };
    }

    // No available balances for the purchase
    throw new Error('No available balances for your purchase.');
  } catch (err) {
    console.log('Send store payment error:', err.message);
    return {didWork: false, reason: err.message};
  }
}
