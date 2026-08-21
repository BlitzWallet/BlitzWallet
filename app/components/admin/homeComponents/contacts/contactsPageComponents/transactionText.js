import { PARENT_ACCOUNT_TRANSFER_MARKER } from '../../../../../functions/messaging/parentAccountTransferMessage';

export const getTransactionContent = ({
  paymentDescription,
  didDeclinePayment,
  txParsed,
  t,
}) => {
  if (txParsed?.[PARENT_ACCOUNT_TRANSFER_MARKER]) {
    if (typeof txParsed.isDeposit === 'boolean') {
      return t(
        txParsed.isDeposit
          ? 'transactionLabelText.accountTopup'
          : 'transactionLabelText.accountWithdrawal',
      );
    }
  }

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
