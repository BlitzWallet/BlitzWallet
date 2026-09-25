import { InputTypes } from 'bitcoin-address-parser';
import { isHTTPS } from '../../../../../functions/lnurl/ishttps';
import { fetchPhonePaymentInvoice } from '../../../../../functions/sendBitcoin/getPhonePaymentAddress';
import { decode as decodeBolt11 } from '../../../../../functions/decodeBolt11';

// LUD-09 successAction is payee-controlled. Only a https URL may
// be persisted; anything else (javascript:/data:/cross-host) is dropped so a
// malicious successAction.url can never reach the browser from history.
export function sanitizeLUD9SuccessAction(successAction, callbackUrl) {
  if (
    !successAction ||
    typeof successAction !== 'object' ||
    Array.isArray(successAction)
  )
    return null;
  // Non-url actions (message/aes) carry no link; drop any url field so it
  // can't bypass the host check below via a different tag.
  if (successAction.tag !== 'url') {
    const { url, ...rest } = successAction;
    return rest;
  }
  const rawUrl =
    typeof successAction.url === 'string' ? successAction.url.trim() : '';
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    return { ...successAction, url: rawUrl };
  } catch {
    return null;
  }
}

export async function getLNAddressForLiquidPayment(
  paymentInfo,
  sendingValue,
  description,
) {
  let invoiceAddress = { pr: '', successAction: null };
  try {
    // POST-based phone providers (e.g. Burundi) mint the invoice via a direct
    // POST rather than an LNURL callback.
    if (paymentInfo?.data?.postProvider) {
      const { pr } = await fetchPhonePaymentInvoice({
        ...paymentInfo.data.postProvider,
        amountSats: sendingValue,
      });
      return { pr, successAction: null };
    }
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

      const decodedInvoice = decodeBolt11(data.pr);
      const requestedMsats = sendingValue * 1000;

      if (
        !decodedInvoice.millisatoshis ||
        decodedInvoice.millisatoshis != requestedMsats
      ) {
        throw new Error(
          `Invoice amount (${decodedInvoice.millisatoshis} msat) does not match requested amount (${requestedMsats} msat)`,
        );
      }

      // Persist only the invoice plus a sanitized successAction so stored
      // history can never carry a javascript:/data: or cross-host URL.
      invoiceAddress = {
        pr: data.pr,
        successAction: sanitizeLUD9SuccessAction(data.successAction, callback),
      };
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
