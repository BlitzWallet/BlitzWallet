import {
  getSparkBitcoinPaymentFeeEstimate,
  getSparkLightningPaymentFeeEstimate,
  getSparkPaymentFeeEstimate,
  getSparkStaticBitcoinL1Address,
  receiveSparkLightningPayment,
  sendSparkBitcoinPayment,
  sendSparkLightningPayment,
  sendSparkPayment,
  getSparkAddress,
  sparkWallet,
  sendSparkTokens,
} from '.';
import {
  isSendingPayingEventEmiiter,
  SENDING_PAYMENT_EVENT_NAME,
} from '../../../context-store/sparkContext';
import calculateProgressiveBracketFee from './calculateSupportFee';
import {
  addSingleUnpaidSparkLightningTransaction,
  bulkUpdateSparkTransactions,
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from './transactions';

export const sparkPaymenWrapper = async ({
  getFee = false,
  address,
  paymentType,
  amountSats = 0,
  exitSpeed = 'FAST',
  masterInfoObject,
  fee,
  memo,
  userBalance = 0,
  sparkInformation,
  feeQuote,
  usingZeroAmountInvoice = false,
  seletctedToken,
}) => {
  try {
    console.log('Begining spark payment');
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const supportFee = await calculateProgressiveBracketFee(
      amountSats,
      paymentType,
    );
    if (getFee) {
      console.log('Calculating spark payment fee');
      let calculatedFee = 0;
      let tempFeeQuote;
      if (paymentType === 'lightning') {
        const routingFee = await getSparkLightningPaymentFeeEstimate(
          address,
          amountSats,
        );

        if (!routingFee.didWork)
          throw new Error(routingFee.error || 'Unable to get routing fee');
        calculatedFee = routingFee.response;
      } else if (paymentType === 'bitcoin') {
        const feeResponse = await getSparkBitcoinPaymentFeeEstimate({
          amountSats,
          withdrawalAddress: address,
        });

        if (!feeResponse.didWork)
          throw new Error(
            feeResponse.error || 'Unable to get Bitcoin fee estimation',
          );
        const data = feeResponse.response;
        calculatedFee =
          data.userFeeFast.originalValue +
          data.l1BroadcastFeeFast.originalValue;
        tempFeeQuote = data;
      } else {
        // Spark payments
        const feeResponse = await getSparkPaymentFeeEstimate(amountSats);
        calculatedFee = feeResponse;
      }
      return {
        didWork: true,
        fee: Math.round(calculatedFee),
        supportFee: Math.round(supportFee),
        feeQuote: tempFeeQuote,
      };
    }
    let response;
    if (
      seletctedToken === 'Bitcoin' &&
      userBalance < amountSats + (paymentType === 'bitcoin' ? supportFee : fee)
    )
      throw new Error('Insufficient funds');

    isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, true);
    if (paymentType === 'lightning') {
      const initialFee = Math.round(fee - supportFee);
      const lightningPayResponse = await sendSparkLightningPayment({
        maxFeeSats: Math.ceil(initialFee * 1.2), //addding 20% buffer so we dont undershoot it
        invoice: address,
        amountSats: usingZeroAmountInvoice ? amountSats : undefined,
      });
      if (!lightningPayResponse.didWork)
        throw new Error(
          lightningPayResponse.error || 'Error when sending lightning payment',
        );

      handleSupportPayment(masterInfoObject, supportFee);

      const data = lightningPayResponse.paymentResponse;

      const tx = {
        id: data.id,
        paymentStatus: 'pending',
        paymentType: 'lightning',
        accountId: sparkInformation.identityPubKey,
        details: {
          fee: fee,
          amount: amountSats,
          description: memo || '',
          address: address,
          time: new Date(data.updatedAt).getTime(),
          createdAt: new Date(data.createdAt).getTime(),
          direction: 'OUTGOING',
          preimage: '',
        },
      };
      response = tx;

      await bulkUpdateSparkTransactions([tx], 'paymentWrapperTx', supportFee);
    } else if (paymentType === 'bitcoin') {
      // make sure to import exist speed
      const onChainPayResponse = await sendSparkBitcoinPayment({
        onchainAddress: address,
        exitSpeed,
        amountSats,
        feeQuote,
        deductFeeFromWithdrawalAmount: true,
      });

      if (!onChainPayResponse.didWork)
        throw new Error(
          onChainPayResponse.error || 'Error when sending bitcoin payment',
        );
      handleSupportPayment(masterInfoObject, supportFee);

      console.log(onChainPayResponse, 'on-chain pay response');
      const data = onChainPayResponse.response;

      const tx = {
        id: data.id,
        paymentStatus: 'pending',
        paymentType: 'bitcoin',
        accountId: sparkInformation.identityPubKey,
        details: {
          fee: fee + supportFee,
          amount: amountSats,
          address: address,
          time: new Date(data.updatedAt).getTime(),
          direction: 'OUTGOING',
          description: memo || '',
          onChainTxid: data.coopExitTxid || '',
        },
      };
      response = tx;
      await bulkUpdateSparkTransactions([tx], 'paymentWrapperTx', supportFee);
    } else {
      let sparkPayResponse;

      if (seletctedToken !== 'Bitcoin') {
        sparkPayResponse = await sendSparkTokens({
          tokenIdentifier: seletctedToken,
          tokenAmount: amountSats,
          receiverSparkAddress: address,
        });
      } else {
        sparkPayResponse = await sendSparkPayment({
          receiverSparkAddress: address,
          amountSats,
        });
      }

      if (!sparkPayResponse.didWork)
        throw new Error(
          sparkPayResponse.error || 'Error when sending spark payment',
        );

      if (seletctedToken === 'Bitcoin') {
        handleSupportPayment(masterInfoObject, supportFee);
      }
      const data = sparkPayResponse.response;
      const tx = {
        id: seletctedToken !== 'Bitcoin' ? data : data.id,
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId:
          seletctedToken !== 'Bitcoin'
            ? sparkInformation.identityPubKey
            : data.senderIdentityPublicKey,
        details: {
          fee: seletctedToken !== 'Bitcoin' ? 0 : supportFee,
          amount: amountSats,
          address: address,
          time:
            seletctedToken !== 'Bitcoin'
              ? new Date().getTime()
              : new Date(data.updatedTime).getTime(),
          direction: 'OUTGOING',
          description: memo || '',
          senderIdentityPublicKey:
            seletctedToken !== 'Bitcoin' ? '' : data.receiverIdentityPublicKey,
          isLRC20Payment: seletctedToken !== 'Bitcoin',
          LRC20Token: seletctedToken,
        },
      };
      response = tx;
      await bulkUpdateSparkTransactions(
        [tx],
        'paymentWrapperTx',
        seletctedToken !== 'Bitcoin' ? 0 : supportFee,
      );
    }
    console.log(response, 'resonse in send function');
    return {didWork: true, response};
  } catch (err) {
    console.log('Send lightning payment error', err);
    return {didWork: false, error: err.message};
  } finally {
    if (!getFee) {
      isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, false);
    }
  }
};

export const sparkReceivePaymentWrapper = async ({
  amountSats,
  memo,
  paymentType,
  shouldNavigate,
}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');

    if (paymentType === 'lightning') {
      const invoiceResponse = await receiveSparkLightningPayment({
        amountSats,
        memo,
      });

      if (!invoiceResponse.didWork) throw new Error(invoiceResponse.error);
      const invoice = invoiceResponse.response;

      const tempTransaction = {
        id: invoice.id,
        amount: amountSats,
        expiration: invoice.invoice.expiresAt,
        description: memo || '',
        shouldNavigate,
        details: {
          createdTime: new Date(invoice.createdAt).getTime(),
          isLNURL: false,
          shouldNavigate: true,
          isBlitzContactPayment: false,
        },
      };
      await addSingleUnpaidSparkLightningTransaction(tempTransaction);
      return {
        didWork: true,
        data: invoice,
        invoice: invoice.invoice.encodedInvoice,
      };
    } else if (paymentType === 'bitcoin') {
      // Handle storage of tx when claiming in spark context
      const depositAddress = await getSparkStaticBitcoinL1Address();
      return {
        didWork: true,
        invoice: depositAddress,
      };
    } else {
      // No need to save address since it is constant
      const sparkAddress = await getSparkAddress();
      if (!sparkAddress.didWork) throw new Error(sparkAddress.error);

      const data = sparkAddress.response;

      return {
        didWork: true,
        invoice: data,
      };
    }
  } catch (err) {
    console.log('Receive spark payment error', err);
    return {didWork: false, error: err.message};
  }
};

async function handleSupportPayment(masterInfoObject, supportFee) {
  try {
    if (!supportFee) return;
    if (masterInfoObject?.enabledDeveloperSupport?.isEnabled) {
      await new Promise(res => setTimeout(res, 1000));
      await sendSparkPayment({
        receiverSparkAddress: process.env.BLITZ_SPARK_SUPPORT_ADDRESSS,
        amountSats: supportFee,
      });
      sparkTransactionsEventEmitter.emit(
        SPARK_TX_UPDATE_ENVENT_NAME,
        'supportTx',
      );
    }
  } catch (err) {
    console.log('Error sending support payment', err);
  }
}
