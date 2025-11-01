export const getTransactionContent = ({
  paymentDescription,
  didDeclinePayment,
  txParsed,
  t,
}) => {
  if (paymentDescription) {
    return paymentDescription;
  }

  if (didDeclinePayment) {
    return txParsed.didSend
      ? t('transactionLabelText.requestDeclined')
      : t('transactionLabelText.declinedRequest');
  }

  if (txParsed.isRequest) {
    if (txParsed.didSend) {
      return txParsed.isRedeemed === null
        ? t('transactionLabelText.requestSent')
        : t('transactionLabelText.requestPaid');
    }
    return t('transactionLabelText.paidRequest');
  }

  return txParsed.didSend
    ? t('transactionLabelText.sent')
    : t('transactionLabelText.received');
};
