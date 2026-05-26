import { crashlyticsLogReport } from '../../../../../functions/crashlyticsLogs';
import { sparkReceivePaymentWrapper } from '../../../../../functions/spark/payments';
import { isHTTPS } from '../../../../../functions/lnurl/ishttps';

export default async function processLNUrlWithdraw(input, context) {
  const { setLoadingMessage, currentWalletMnemoinc, t, sendWebViewRequest } =
    context;
  crashlyticsLogReport('Begining LNURL withdrawl process');
  setLoadingMessage(
    t('wallet.sendPages.handlingAddressErrors.lnurlWithdrawlStart'),
  );

  const maxAmount = input.data.maxWithdrawable;

  const invoice = await sparkReceivePaymentWrapper({
    amountSats: Math.round(maxAmount / 1000),
    memo: input.data.defaultDescription || '',
    paymentType: 'lightning',
    mnemoinc: currentWalletMnemoinc,
    sendWebViewRequest,
  });

  if (!invoice.didWork)
    throw new Error(
      t('wallet.sendPages.handlingAddressErrors.lnurlWithdrawlInvoiceError'),
    );

  const callbackUrl = new URL(input.data.callback);
  callbackUrl.searchParams.set('k1', input.data.k1);
  callbackUrl.searchParams.set('pr', invoice.invoice);

  if (!isHTTPS(callbackUrl.toString())) throw new Error('LNURL must use HTTPS');

  const callbackResponse = await fetch(callbackUrl.toString());
  const responseData = await callbackResponse.json();

  if (responseData.status === 'ERROR') {
    throw new Error(responseData.reason);
  }
  setLoadingMessage(
    t('wallet.sendPages.handlingAddressErrors.waitingForLnurlWithdrawl'),
  );
}
