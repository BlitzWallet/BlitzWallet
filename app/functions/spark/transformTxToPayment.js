import {sparkPaymentType} from '.';

export async function transformTxToPaymentObject(
  tx,
  sparkAddress,
  forcePaymentType,
  isRestore,
  unpaidLNInvoices,
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
        Math.abs(details.createdTime - new Date(tx.createdTime).getTime()) <
          1000 * 30
      );
    });

    return {
      id: tx.id,
      paymentStatus: 'pending',
      paymentType: 'lightning',
      accountId: tx.receiverIdentityPublicKey,
      details: {
        fee: 0,
        amount: tx.totalValue,
        address: '',
        time: tx.updatedTime
          ? new Date(tx.updatedTime).getTime()
          : new Date().getTime(),
        direction: tx.transferDirection,
        description: '',
        preimage: '',
        isRestore,
        isBlitzContactPayment: foundInvoice
          ? JSON.parse(foundInvoice.details).isBlitzContactPayment
          : undefined,
        shouldNavigate: foundInvoice ? foundInvoice.shouldNavigate : undefined,
        isLNULR: foundInvoice
          ? JSON.parse(foundInvoice.details).isLNURL
          : undefined,
      },
    };
  } else if (paymentType === 'spark') {
    return {
      id: tx.id,
      paymentStatus: 'completed',
      paymentType: 'spark',
      accountId: tx.receiverIdentityPublicKey,
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
      accountId:
        tx.transferDirection === 'OUTGOING'
          ? tx.senderIdentityPublicKey
          : tx.receiverIdentityPublicKey,
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
