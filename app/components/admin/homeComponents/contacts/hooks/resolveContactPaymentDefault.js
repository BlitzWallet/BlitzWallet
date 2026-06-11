export function resolveContactPaymentDefault({
  paymentType,
  prefetchedDoc,
  contactReceiveOption,
  isLNURL,
  masterInfoObject,
  dollarBalanceToken,
}) {
  if (paymentType === 'send') {
    if (isLNURL) return 'BTC';

    const defaultMethod =
      contactReceiveOption ||
      (prefetchedDoc?.lnurlReceiveCurrency?.toLowerCase() === 'usd'
        ? 'USD'
        : 'BTC');

    if (defaultMethod === 'USD' && Number(dollarBalanceToken) <= 0) {
      return 'BTC';
    }

    return defaultMethod;
  }

  return masterInfoObject?.lnurlReceiveCurrency?.toLowerCase() === 'usd'
    ? 'USD'
    : 'BTC';
}
