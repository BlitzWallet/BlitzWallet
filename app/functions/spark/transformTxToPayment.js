import {getSparkPaymentStatus, sparkPaymentType} from '.';

export async function transformTxToPaymentObject(
  tx,
  sparkAddress,
  forcePaymentType,
  isRestore,
  unpaidLNInvoices,
  identityPubKey,
) {
  // Defer all payments to the 10 second interval to be updated
  const paymentType = forcePaymentType
    ? forcePaymentType
    : sparkPaymentType(tx);

  if (paymentType === 'lightning') {
    const foundInvoice = unpaidLNInvoices.find(item => {
      const details = JSON.parse(item.details);
      return (
        item.amount === tx.totalValue &&
        Math.abs(details?.createdTime - new Date(tx.createdTime).getTime()) <
          1000 * 30
      );
    });

    const status = getSparkPaymentStatus(tx.status);
    const userRequest = tx.userRequest;

    return {
      id: tx.id,
      paymentStatus: status,
      paymentType: 'lightning',
      accountId: identityPubKey,
      details: {
        fee: 0,
        amount: tx.totalValue,
        address: userRequest ? userRequest.invoice.encodedInvoice : '',
        time: tx.updatedTime
          ? new Date(tx.updatedTime).getTime()
          : new Date().getTime(),
        direction: tx.transferDirection,
        description: foundInvoice?.description || '',
        preimage: userRequest ? userRequest.invoice.paymentPreimage || '' : '',
        isRestore,
        isBlitzContactPayment: foundInvoice
          ? JSON.parse(foundInvoice.details)?.isBlitzContactPayment
          : undefined,
        shouldNavigate: foundInvoice ? foundInvoice?.shouldNavigate : undefined,
        isLNURL: foundInvoice
          ? JSON.parse(foundInvoice.details)?.isLNURL
          : undefined,
      },
    };
  } else if (paymentType === 'spark') {
    return {
      id: tx.id,
      paymentStatus: 'completed',
      paymentType: 'spark',
      accountId: identityPubKey,
      details: {
        fee: 0,
        amount: tx.totalValue,
        address: sparkAddress,
        time: tx.updatedTime
          ? new Date(tx.updatedTime).getTime()
          : new Date().getTime(),
        direction: tx.transferDirection,
        senderIdentityPublicKey: tx.senderIdentityPublicKey,
        description: '',
        isRestore,
      },
    };
  } else {
    return {
      id: tx.id,
      paymentStatus: 'pending',
      paymentType: 'bitcoin',
      accountId: identityPubKey,
      details: {
        fee: 0,
        amount: tx.totalValue,
        address: tx.address || '',
        time: tx.updatedTime
          ? new Date(tx.updatedTime).getTime()
          : new Date().getTime(),
        direction: tx.transferDirection,
        description: '',
        onChainTxid: tx.txid,
        refundTx: tx.refundTx,
        isRestore,
      },
    };
  }
}
