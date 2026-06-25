import { InputTypes } from 'bitcoin-address-parser';
import { isHTTPS } from '../../../../../functions/lnurl/ishttps';

export async function getLNAddressForLiquidPayment(
  paymentInfo,
  sendingValue,
  description,
) {
  let invoiceAddress = { pr: '', successAction: null };
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

      // LUD-18: when the service advertises a payerData record requesting an
      // `identifier`, attach the user's Lightning Address as a refund destination
      // (used by MoneyBadger / cryptoqr.net merchants to return failed/over-payments).
      const refundLightningAddress = paymentInfo?.data?.refundLightningAddress;
      if (paymentInfo?.data?.payerData?.identifier && refundLightningAddress) {
        const payerData = { identifier: refundLightningAddress };
        url += `&payerdata=${encodeURIComponent(JSON.stringify(payerData))}`;
      }

      console.log('Generated URL:', url);

      if (!isHTTPS(url)) throw new Error('LNURL must use HTTPS');

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.pr) {
        throw new Error('No invoice (pr) in response');
      }

      invoiceAddress = data;
    } else {
      invoiceAddress = {
        pr: paymentInfo.data.invoice.bolt11,
        successAction: null,
      };
    }
  } catch (err) {
    console.log('get ln address for liquid payment error', err);
    invoiceAddress = { pr: '', successAction: null };
  }
  return invoiceAddress;
}
