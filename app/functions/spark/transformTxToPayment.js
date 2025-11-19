import { decode } from 'bolt11';
import { getSparkPaymentStatus, sparkPaymentType } from '.';
import calculateProgressiveBracketFee from './calculateSupportFee';

export async function transformTxToPaymentObject(
  tx,
  sparkAddress,
  forcePaymentType,
  isRestore,
  unpaidLNInvoices,
  identityPubKey,
  numTxsBeingRestored = 1,
  forceOutgoing = false,
) {
  // Defer all payments to the 10 second interval to be updated
  const paymentType = forcePaymentType
    ? forcePaymentType
    : sparkPaymentType(tx);
  const paymentAmount = tx.totalValue;

  const accountId = forceOutgoing
    ? tx.receiverIdentityPublicKey
    : tx.transferDirection === 'OUTGOING'
    ? tx.senderIdentityPublicKey
    : tx.receiverIdentityPublicKey;

  if (paymentType === 'lightning') {
    const userRequest = tx.userRequest;
    const userRequestId = userRequest?.id;
    const foundInvoice = unpaidLNInvoices.find(item => {
      const details = JSON.parse(item.details);
      return (
        item.amount === tx.totalValue &&
        (Math.abs(details?.createdTime - new Date(tx.createdTime).getTime()) <
          1000 * 30 ||
          item.id === userRequestId)
      );
    });

    const status = getSparkPaymentStatus(tx.status);
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
    const preimage = userRequest ? userRequest?.paymentPreimage || '' : '';
    const supportFee = await calculateProgressiveBracketFee(
      paymentAmount,
      'lightning',
    );

    const foundInvoiceDetails = foundInvoice
      ? JSON.parse(foundInvoice.details)
      : undefined;

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
      paymentStatus: status === 'completed' || preimage ? 'completed' : status,
      paymentType: 'lightning',
      accountId: accountId,
      details: {
        fee: paymentFee,
        totalFee: paymentFee + supportFee,
        supportFee: supportFee,
        amount: paymentAmount - paymentFee,
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
        preimage: preimage,
        isRestore,
        isBlitzContactPayment: foundInvoiceDetails
          ? foundInvoiceDetails?.isBlitzContactPayment
          : undefined,
        shouldNavigate: foundInvoice ? foundInvoice?.shouldNavigate : undefined,
        isLNURL: foundInvoiceDetails ? foundInvoiceDetails?.isLNURL : undefined,
        sendingUUID: foundInvoiceDetails
          ? foundInvoiceDetails?.sendingUUID
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
      accountId: accountId,
      details: {
        fee: paymentFee,
        totalFee: paymentFee + supportFee,
        supportFee: supportFee,
        amount: paymentAmount - paymentFee,
        address: sparkAddress,
        time: tx.updatedTime
          ? new Date(tx.updatedTime).getTime()
          : new Date().getTime(),
        direction: tx.transferDirection,
        senderIdentityPublicKey: tx.senderIdentityPublicKey,
        description: tx.description || '',
        isGift: tx.isGift,
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
      accountId: accountId,
      details: {
        fee,
        totalFee: blitzFee + fee,
        supportFee: blitzFee,
        amount: paymentAmount - fee,
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
