import {BLITZ_DEFAULT_PAYMENT_DESCRIPTION} from '../../constants';
import {breezLiquidReceivePaymentWrapper} from '../breezLiquid';

async function lnToLiquidInvoiceDetails({receivingAmount, description}) {
  const addressResponse = await breezLiquidReceivePaymentWrapper({
    sendAmount: receivingAmount,
    paymentType: 'lightning',
    description: description || BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
  });

  if (!addressResponse) {
    return {
      generatedAddress: null,
      errorMessageText: {
        type: 'stop',
        text: `Unable to generate lightning address`,
      },
    };
  }
  const {destination, receiveFeesSat} = addressResponse;

  return {
    generatedAddress: destination,
    fee: receiveFeesSat,
  };
}

export {lnToLiquidInvoiceDetails};
