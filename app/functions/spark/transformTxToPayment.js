import {sparkPaymentType} from '.';

export function transformTxToPaymentObject(
  tx,
  sparkAddress,
  forcePaymentType,
  isRestore,
) {
  // Defer all payments to the 10 second interval to be updated
  const paymentType = forcePaymentType
    ? forcePaymentType
    : sparkPaymentType(tx);

  if (paymentType === 'lightning') {
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
