import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';

export async function getLNAddressForLiquidPayment(
  paymentInfo,
  sendingValue,
  description,
) {
  let invoiceAddress;
  try {
    if (paymentInfo.type === InputTypeVariant.LN_URL_PAY) {
      const url = `${paymentInfo.data.callback}?amount=${sendingValue * 1000}${
        !!paymentInfo?.data.commentAllowed
          ? `&comment=${encodeURIComponent(
              paymentInfo?.data?.message || description || '',
            )}`
          : ''
      }`;

      console.log('Generated URL:', url);
      const response = await fetch(url);

      const bolt11Invoice = (await response.json()).pr;

      invoiceAddress = bolt11Invoice;
    } else {
      invoiceAddress = paymentInfo.data.invoice.bolt11;
    }
  } catch (err) {
    console.log('get ln address for liquid payment error', err);
    invoiceAddress = '';
  }

  return invoiceAddress;
}
