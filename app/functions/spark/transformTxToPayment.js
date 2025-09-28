import {decode} from 'bolt11';
import {getSparkPaymentStatus, sparkPaymentType} from '.';
import calculateProgressiveBracketFee from './calculateSupportFee';

export async function transformTxToPaymentObject(
  tx,
  sparkAddress,
  forcePaymentType,
  isRestore,
  unpaidLNInvoices,
  identityPubKey,
  numTxsBeingRestored = 1,
) {
  // Defer all payments to the 10 second interval to be updated
  const paymentType = forcePaymentType
    ? forcePaymentType
    : sparkPaymentType(tx);
  const paymentAmount = tx.totalValue;

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
    const isSendRequest = userRequest?.typename === 'LightningSendRequest';
    const invoice = userRequest
      ? isSendRequest
        ? userRequest?.encodedInvoice
        : userRequest.invoice?.encodedInvoice
      : '';

    const paymentFee = userRequest
      ? isSendRequest
        ? userRequest.fee.originalValue /
          (userRequest.fee.originalUnit === 'MILLISATOSHI' ? 1000 : 1)
        : 0
      : 0;

    const supportFee = await calculateProgressiveBracketFee(
      paymentAmount,
      'lightning',
    );

    const description =
      numTxsBeingRestored < 20
        ? invoice
          ? decode(invoice).tags.find(tag => tag.tagName === 'description')
              ?.data ||
            foundInvoice?.description ||
            ''
          : foundInvoice?.description || ''
        : '';

    return {
      id: tx.transfer ? tx.transfer.sparkId : tx.id,
      paymentStatus: status,
      paymentType: 'lightning',
      accountId: identityPubKey,
      details: {
        fee: paymentFee,
        totalFee: paymentFee + supportFee,
        supportFee: supportFee,
        amount: paymentAmount,
        address: userRequest
          ? isSendRequest
            ? userRequest?.encodedInvoice
            : userRequest.invoice?.encodedInvoice
          : '',
        time: tx.updatedTime
          ? new Date(tx.updatedTime).getTime()
          : new Date().getTime(),
        direction: tx.transferDirection,
        description: description,
        preimage: userRequest ? userRequest?.paymentPreimage || '' : '',
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
    const paymentFee = tx.transferDirection === 'OUTGOING' ? 0 : 0;
    const supportFee = await (tx.transferDirection === 'OUTGOING'
      ? calculateProgressiveBracketFee(paymentAmount, 'spark')
      : Promise.resolve(0));

    return {
      id: tx.id,
      paymentStatus: 'completed',
      paymentType: 'spark',
      accountId: identityPubKey,
      details: {
        fee: paymentFee,
        totalFee: paymentFee + supportFee,
        supportFee: supportFee,
        amount: paymentAmount,
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
    const status = getSparkPaymentStatus(tx.status);
    const userRequest = tx.userRequest;

    let fee = 0;
    let blitzFee = 0;

    if (
      tx.transferDirection === 'OUTGOING' &&
      userRequest?.fee &&
      userRequest?.l1BroadcastFee
    ) {
      fee =
        userRequest.fee.originalValue /
          (userRequest.fee.originalUnit === 'SATOSHI' ? 1 : 1000) +
        userRequest.l1BroadcastFee.originalValue /
          (userRequest.l1BroadcastFee.originalUnit === 'SATOSHI' ? 1 : 1000);

      blitzFee = await calculateProgressiveBracketFee(paymentAmount, 'bitcoin');
    }

    return {
      id: tx.id,
      paymentStatus: status,
      paymentType: 'bitcoin',
      accountId: identityPubKey,
      details: {
        fee,
        totalFee: blitzFee + fee,
        supportFee: blitzFee,
        amount: paymentAmount,
        address: tx.address || '',
        time: tx.updatedTime
          ? new Date(tx.updatedTime).getTime()
          : new Date().getTime(),
        direction: tx.transferDirection,
        description: '',
        onChainTxid:
          tx.transferDirection === 'OUTGOING'
            ? userRequest?.coopExitTxid || ''
            : userRequest?.transactionId || '',
        refundTx: tx.refundTx || '',
        isRestore,
      },
    };
  }
}
