import {
  getSparkBitcoinPaymentRequest,
  getSparkLightningSendRequest,
  getSparkStaticBitcoinL1Address,
  sendSparkBitcoinPayment,
  sendSparkLightningPayment,
  sendSparkPayment,
  sparkWallet,
} from '.';

import {SPARK_TO_LN_FEE, SPARK_TO_SPARK_FEE} from '../../constants/math';
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
}) => {
  try {
    console.log('Begining spark payment');
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const supportFee = calculateProgressiveBracketFee(amountSats);
    if (getFee) {
      console.log('Calculating spark payment fee');
      let calculatedFee = 0;
      if (paymentType === 'lightning') {
        const routingFee = await sparkWallet.getLightningSendFeeEstimate({
          encodedInvoice: address,
        });
        calculatedFee = routingFee + amountSats * SPARK_TO_LN_FEE;
      } else if (paymentType === 'bitcoin') {
        const feeResponse = await sparkWallet.getWithdrawalFeeEstimate({
          amountSats,
          withdrawalAddress: address,
        });
        calculatedFee =
          feeResponse.speedFast.userFee.originalValue +
          feeResponse.speedFast.l1BroadcastFee.originalValue;
      } else {
        // Spark payments
        const feeResponse = await sparkWallet.getSwapFeeEstimate(amountSats);
        calculatedFee =
          feeResponse.feeEstimate.originalValue || SPARK_TO_SPARK_FEE;
      }
      return {
        didWork: true,
        fee: Math.round(calculatedFee),
        supportFee: Math.round(supportFee),
      };
    }
    let response;
    if (
      userBalance <
      amountSats + (paymentType === 'bitcoin' ? supportFee : fee)
    )
      throw new Error('Insufficient funds');

    let supportFeeResponse;

    if (paymentType === 'lightning') {
      const lightningPayResponse = await sendSparkLightningPayment({
        invoice: address,
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
          direction: 'OUTGOING',
          preimage: '',
        },
      };
      response = tx;

      await bulkUpdateSparkTransactions([tx], 'paymentWrapperTx');
    } else if (paymentType === 'bitcoin') {
      // make sure to import exist speed
      const onChainPayResponse = await sendSparkBitcoinPayment({
        onchainAddress: address,
        exitSpeed,
        amountSats,
      });
      if (!onChainPayResponse)
        throw new Error('Error when sending bitcoin payment');
      handleSupportPayment(masterInfoObject, supportFee);

      console.log(onChainPayResponse, 'on-chain pay response');
      let sparkQueryResponse = null;
      let count = 0;
      while (!sparkQueryResponse && count < 5) {
        const sparkResponse = await getSparkBitcoinPaymentRequest(
          onChainPayResponse.id,
        );

        if (sparkResponse?.transfer) {
          sparkQueryResponse = sparkResponse;
        } else {
          console.log('Waiting for response...');
          await new Promise(res => setTimeout(res, 2000));
        }
        count += 1;
      }

      console.log(
        sparkQueryResponse,
        'on-chain query response after confirmation',
      );
      const tx = {
        id: sparkQueryResponse
          ? sparkQueryResponse.transfer.sparkId
          : onChainPayResponse.id,
        paymentStatus: 'pending',
        paymentType: 'bitcoin',
        accountId: sparkInformation.identityPubKey,
        details: {
          fee: fee + supportFee,
          amount: amountSats,
          address: address,
          time: new Date(onChainPayResponse.updatedAt).getTime(),
          direction: 'OUTGOING',
          description: memo || '',
          onchainTxid: onChainPayResponse.coopExitTxid,
        },
      };
      response = tx;
      await bulkUpdateSparkTransactions([tx], 'paymentWrapperTx');
    } else {
      const sparkPayResponse = await sendSparkPayment({
        receiverSparkAddress: address,
        amountSats,
      });
      if (!sparkPayResponse)
        throw new Error('Error when sending spark payment');

      handleSupportPayment(masterInfoObject, supportFee);

      const tx = {
        id: sparkPayResponse.id,
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: sparkPayResponse.senderIdentityPublicKey,
        details: {
          fee: fee,
          amount: amountSats,
          address: address,
          time: new Date(sparkPayResponse.updatedTime).getTime(),
          direction: 'OUTGOING',
          description: memo || '',
          senderIdentityPublicKey: sparkPayResponse.receiverIdentityPublicKey,
        },
      };
      response = tx;
      await bulkUpdateSparkTransactions([tx], 'paymentWrapperTx');
    }
    console.log(response, 'resonse in send function');
    return {didWork: true, response};
  } catch (err) {
    console.log('Send lightning payment error', err);
    return {didWork: false, error: err.message};
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
      const invoice = await sparkWallet.createLightningInvoice({
        amountSats,
        memo,
        expirySeconds: 1000 * 60 * 60 * 24, //Add 24 hours validity to invoice
      });

      const tempTransaction = {
        id: invoice.id,
        amount: amountSats,
        expiration: invoice.invoice.expiresAt,
        description: memo || '',
        shouldNavigate,
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
      const sparkAddress = await sparkWallet.getSparkAddress();
      return {
        didWork: true,
        invoice: sparkAddress,
      };
    }
  } catch (err) {
    console.log('Receive spark payment error', err);
    return {didWork: false, error: err.message};
  }
};

async function handleSupportPayment(masterInfoObject, supportFee) {
  try {
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
