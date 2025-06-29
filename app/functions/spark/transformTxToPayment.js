import {
  getSparkLightningPaymentStatus,
  getSparkPaymentStatus,
  sparkPaymentType,
} from '.';
import {
  deleteUnpaidSparkLightningTransaction,
  getAllUnpaidSparkLightningInvoices,
} from './transactions';

export async function transformTxToPaymentObject(
  tx,
  sparkAddress,
  forcePaymentType,
  isRestore,
) {
  const paymentType = forcePaymentType
    ? forcePaymentType
    : sparkPaymentType(tx);

  if (paymentType === 'lightning') {
    const unpaidInvoices = await getAllUnpaidSparkLightningInvoices();
    const possibleMatches = unpaidInvoices.filter(
      inv => inv.amount === tx.totalValue,
    );

    for (const invoice of possibleMatches) {
      let attempts = 0;
      let paymentDetails = null;

      while (attempts < 5) {
        const result = await getSparkLightningPaymentStatus({
          lightningInvoiceId: invoice.sparkID,
        });

        if (result?.transfer) {
          paymentDetails = result;
          break;
        }

        await new Promise(res => setTimeout(res, 1000));
        attempts++;
      }

      if (paymentDetails?.transfer?.sparkId === tx.id) {
        await deleteUnpaidSparkLightningTransaction(invoice.sparkID);

        return {
          id: tx.id,
          paymentStatus: getSparkPaymentStatus(tx.status),
          paymentType: 'lightning',
          accountId: tx.receiverIdentityPublicKey,
          details: {
            fee: 0,
            amount: tx.totalValue,
            address: paymentDetails?.invoice?.encodedInvoice || '',
            time: tx.updatedTime
              ? new Date(tx.updatedTime).getTime()
              : new Date().getTime(),
            direction: tx.transferDirection,
            description: invoice?.description || '',
            preimage: paymentDetails?.paymentPreimage || '',
            isRestore,
          },
        };
      }
    }
    return {
      id: tx.id,
      paymentStatus: getSparkPaymentStatus(tx.status),
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
  }

  if (paymentType === 'spark') {
    return {
      id: tx.id,
      paymentStatus: getSparkPaymentStatus(tx.status),
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
  }

  if (paymentType === 'bitcoin') {
    return {
      id: tx.id,
      paymentStatus: getSparkPaymentStatus(tx.status),
      paymentType: 'bitcoin',
      accountId: tx.ownerIdentityPublicKey,
      details: {
        fee: 0,
        amount: tx.value,
        address: tx.address,
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

  return null;
}
