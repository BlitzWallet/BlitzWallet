import { InputTypes } from 'bitcoin-address-parser';

export async function getLNAddressForLiquidPayment(
  paymentInfo,
  sendingValue,
  description,
) {
  let invoiceAddress;
  try {
    if (paymentInfo.type === InputTypes.LNURL_PAY) {
      const callback = paymentInfo.data.callback;

      const hasQueryParams = callback.includes('?');
      const separator = hasQueryParams ? '&' : '?';

      let url = `${callback}${separator}amount=${sendingValue * 1000}`;

      if (paymentInfo?.data.commentAllowed) {
        const comment = encodeURIComponent(
          paymentInfo?.data?.message || description || '',
        );
        url += `&comment=${comment}`;
      }

      console.log('Generated URL:', url);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.pr) {
        throw new Error('No invoice (pr) in response');
      }

      invoiceAddress = data.pr;
    } else {
      invoiceAddress = paymentInfo.data.invoice.bolt11;
    }
  } catch (err) {
    console.log('get ln address for liquid payment error', err);
    invoiceAddress = '';
  }
  return invoiceAddress;
}
