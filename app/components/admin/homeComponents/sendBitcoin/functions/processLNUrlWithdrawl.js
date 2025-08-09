import {crashlyticsLogReport} from '../../../../../functions/crashlyticsLogs';
import {sparkReceivePaymentWrapper} from '../../../../../functions/spark/payments';
import {getSparkLightningPaymentStatus} from '../../../../../functions/spark';

export default async function processLNUrlWithdraw(input, context) {
  const {setLoadingMessage, currentWalletMnemoinc} = context;
  crashlyticsLogReport('Begining LNURL withdrawl process');
  setLoadingMessage('Generating invoice for withdrawl');

  const minAmount = input.data.minWithdrawable;

  const invoice = await sparkReceivePaymentWrapper({
    amountSats: Math.round(minAmount / 1000),
    memo: input.data.defaultDescription || '',
    paymentType: 'lightning',
  });

  if (!invoice.didWork)
    throw new Error('Unable to generate invoice for lnurl withdrawl');

  const callbackUrl = new URL(input.data.callback);
  callbackUrl.searchParams.set('k1', input.data.k1);
  callbackUrl.searchParams.set('pr', invoice.invoice);

  const callbackResponse = await fetch(callbackUrl.toString());
  const responseData = await callbackResponse.json();

  if (responseData.status === 'ERROR') {
    throw new Error(responseData.reason);
  }
  setLoadingMessage('Waiting for payment...');
  await pollForResponse(invoice.data, currentWalletMnemoinc);
}

async function pollForResponse(invoiceData, currentWalletMnemoinc) {
  let didFind = false;
  let maxCount = 5;
  let currentCount = 0;
  while (!didFind && currentCount < maxCount) {
    await new Promise(res => setTimeout(res, 5000));
    const sparkReceiveResposne = await getSparkLightningPaymentStatus({
      lightningInvoiceId: invoiceData.id,
      mnemonic: currentWalletMnemoinc,
    });
    if (sparkReceiveResposne.transfer) break;
  }
  await new Promise(res => setTimeout(res, 8000));
}
