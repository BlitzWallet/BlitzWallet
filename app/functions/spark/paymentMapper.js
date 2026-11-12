import { USDB_TOKEN_ID } from '../../constants';

const methodToType = method =>
  method === 'lightning'
    ? 'lightning'
    : method === 'withdraw' || method === 'deposit'
    ? 'bitcoin'
    : method === 'spark' || method === 'token'
    ? 'spark'
    : 'unknown';

export const mapBreezStatus = status =>
  status === 'completed'
    ? 'completed'
    : status === 'failed'
    ? 'failed'
    : 'pending';

function sparkIdFor(payment, ctx) {
  if (payment.method !== 'token') return payment.id;
  const txHash = payment.details?.txHash;
  if (!txHash) return payment.id;
  const existing = ctx?.existingBySparkId?.(txHash);
  if (
    existing &&
    existing.breezPaymentId &&
    existing.breezPaymentId !== payment.id
  ) {
    return payment.id; // collision: keep hash:vout for the second output
  }
  return txHash;
}

export function mapBreezPayment(payment, ctx = {}) {
  if (!payment) return null;
  if (!ctx.accountId) throw new Error('paymentMapper: accountId required');

  const details = payment.details;
  if (details?.conversionInfo) return null; // Blitz does not use Breez conversions
  if (payment.conversionDetails) return null;

  const sparkID = sparkIdFor(payment, ctx);
  if (ctx.isHidden?.(sparkID) || ctx.isHidden?.(payment.id)) return null;
  if (
    payment.method === 'token' &&
    details?.txHash &&
    ctx.isHidden?.(details.txHash)
  )
    return null;

  const annotation =
    ctx.getAnnotation?.({
      id: payment.id,
      txHash: details?.txHash,
      invoice:
        details?.type === 'lightning'
          ? details.invoice
          : details?.invoiceDetails?.invoice,
      paymentHash: details?.htlcDetails?.paymentHash || details?.paymentHash,
      txid: details?.txId,
      vout: details?.vout,
    }) || {};

  const record = {
    sparkID,
    paymentStatus: mapBreezStatus(payment.status),
    paymentType: methodToType(payment.method),
    accountId: ctx.accountId,
    details: {
      direction: payment.paymentType === 'send' ? 'OUTGOING' : 'INCOMING',
      amount: Number(payment.amount),
      fee: Number(payment.fees),
      totalFee: Number(payment.fees),
      supportFee: 0,
      time: Number(payment.timestamp) * 1000,
      createdAt: Number(payment.timestamp) * 1000,
      breezPaymentId: payment.id,
      breezMethod: payment.method,
      ...annotation,
    },
  };

  if (details?.type === 'lightning') {
    record.details.address = details.invoice;
    record.details.description =
      details.description || annotation.description || '';
    record.details.preimage = details.htlcDetails?.preimage || '';
    record.details.paymentHash = details.htlcDetails?.paymentHash || '';
    record.details.htlcStatus = details.htlcDetails?.status;
  } else if (details?.type === 'token') {
    record.details.isLRC20Payment = true;
    record.details.LRC20Token = details.metadata?.identifier || USDB_TOKEN_ID;
    record.details.description =
      details.invoiceDetails?.description || annotation.description || '';
    record.details.txHash = details.txHash;
    record.details.tokenMetadata = details.metadata;
  } else if (details?.type === 'spark') {
    record.details.description =
      details.invoiceDetails?.description || annotation.description || '';
    if (details.invoiceDetails?.invoice) {
      record.details.address = details.invoiceDetails.invoice;
    }
  } else if (details?.type === 'withdraw') {
    record.details.onChainTxid = details.txId;
  } else if (details?.type === 'deposit') {
    record.details.onChainTxid = details.txId;
    record.details.vout = details.vout;
  }

  if (ctx.mode === 'RECONCILE') {
    return {
      sparkID: record.sparkID,
      paymentStatus: record.paymentStatus,
      accountId: record.accountId,
      details: {
        preimage: record.details.preimage,
        onChainTxid: record.details.onChainTxid,
        vout: record.details.vout,
        paymentHash: record.details.paymentHash,
        breezPaymentId: record.details.breezPaymentId,
      },
    };
  }

  return record;
}

export function paymentToIntentPlaceholder(payment, accountId) {
  return {
    id: payment.id,
    paymentStatus: 'pending',
    paymentType: methodToType(payment.method),
    accountId,
    details: {
      isPlaceholder: true,
      isIntentPlaceholder: true,
      direction: payment.paymentType === 'send' ? 'OUTGOING' : 'INCOMING',
      amount: Number(payment.amount),
      time: Number(payment.timestamp) * 1000,
      breezPaymentId: payment.id,
    },
  };
}
