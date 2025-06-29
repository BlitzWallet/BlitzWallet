import {
  SparkWallet,
  ReactNativeSparkSigner,
  getLatestDepositTxId,
} from '@buildonspark/spark-sdk/native';
import {getAllSparkTransactions} from './transactions';
import {SPARK_TO_SPARK_FEE} from '../../constants/math';

export let sparkWallet = null;

export const initializeSparkWallet = async mnemonic => {
  try {
    const {wallet} = await SparkWallet.initialize({
      signer: new ReactNativeSparkSigner(),
      mnemonicOrSeed: mnemonic,
      options: {network: 'MAINNET'},
    });
    // const [type, value] = await Promise.race([
    //   SparkWallet.initialize({
    //     signer: new ReactNativeSparkSigner(),
    //     mnemonicOrSeed: mnemonic,
    //     options: {network: 'MAINNET'},
    //   }).then(res => ['wallet', res]),
    //   new Promise(res => setTimeout(() => res(['timeout', false]), 30000)),
    // ]);
    sparkWallet = wallet;

    return {isConnected: true};

    // if (type === 'wallet') {
    //   const {wallet} = value;
    //   console.log('Wallet initialized:', await wallet.getIdentityPublicKey());
    //   sparkWallet = wallet;

    //   return {isConnected: true};
    // } else if (type === 'timeout') {
    //   return {isConnected: false};
    // }
  } catch (err) {
    console.log('Initialize spark wallet error', err);
    return {isConnected: false};
  }
};

export const getSparkIdentityPubKey = async () => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.getIdentityPublicKey();
  } catch (err) {
    console.log('Get spark balance error', err);
  }
};
export const initializeTempSparkWallet = async mnemoinc => {
  try {
    const {wallet: w} = await SparkWallet.initialize({
      signer: new ReactNativeSparkSigner(),
      mnemonicOrSeed: mnemoinc,
      options: {network: 'MAINNET'},
    });

    return w;
  } catch (err) {
    console.log('Initialize spark wallet error', err);
  }
};

export const getSparkBalance = async () => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.getBalance();
  } catch (err) {
    console.log('Get spark balance error', err);
  }
};

export const getSparkBitcoinL1Address = async () => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.getSingleUseDepositAddress();
  } catch (err) {
    console.log('Get Bitcoin mainchain address error', err);
  }
};

export const getSparkStaticBitcoinL1Address = async () => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.getStaticDepositAddress();
  } catch (err) {
    console.log('Get reusable Bitcoin mainchain address error', err);
  }
};

export const queryAllStaticDepositAddresses = async () => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.queryStaticDepositAddresses();
  } catch (err) {
    console.log('refund reusable Bitcoin mainchain address error', err);
  }
};
export const getSparkStaticBitcoinL1AddressQuote = async txid => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return {
      didwork: true,
      quote: await sparkWallet.getClaimStaticDepositQuote(txid),
    };
  } catch (err) {
    console.log('Get reusable Bitcoin mainchain address quote error', err);
    return {didwork: false, error: err.message};
  }
};
export const refundSparkStaticBitcoinL1AddressQuote = async ({
  depositTransactionId,
  destinationAddress,
  fee,
}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.refundStaticDeposit({
      depositTransactionId,
      destinationAddress,
      fee,
    });
  } catch (err) {
    console.log('refund reusable Bitcoin mainchain address error', err);
  }
};

export const claimnSparkStaticDepositAddress = async ({
  creditAmountSats,
  outputIndex,
  sspSignature,
  transactionId,
}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.claimStaticDeposit({
      creditAmountSats,
      sspSignature,
      transactionId,
    });
  } catch (err) {
    console.log('claim static deposit address error', err);
  }
};

export const getUnusedSparkBitcoinL1Address = async () => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return (await sparkWallet.getUnusedDepositAddresses()) || [];
  } catch (err) {
    console.log('Get Bitcoin mainchain address error', err);
  }
};

export const querySparkBitcoinL1Transaction = async depositAddress => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await getLatestDepositTxId(depositAddress);
  } catch (err) {
    console.log('Get latest deposit address information error', err);
  }
};

export const claimSparkBitcoinL1Transaction = async depositAddress => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const txId = await querySparkBitcoinL1Transaction(depositAddress);
    const claimResponse = await (txId
      ? sparkWallet.claimDeposit(txId)
      : Promise.resolve(null));
    return [txId, claimResponse];
  } catch (err) {
    console.log('Claim bitcoin mainnet payment error', err);
  }
};

export const getSparkAddress = async () => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.getSparkAddress();
  } catch (err) {
    console.log('Get spark address error', err);
  }
};

export const sendSparkPayment = async ({receiverSparkAddress, amountSats}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const response = await sparkWallet.transfer({
      receiverSparkAddress,
      amountSats,
    });
    console.log('spark payment response', response);
    return response;
  } catch (err) {
    console.log('Send spark payment error', err);
  }
};

export const sendSparkTokens = async ({
  tokenPublicKey,
  tokenAmount,
  receiverSparkAddress,
}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.transferTokens({
      tokenPublicKey,
      tokenAmount,
      receiverSparkAddress,
    });
  } catch (err) {
    console.log('Send spark token error', err);
  }
};

export const getSparkLightningPaymentFeeEstimate = async invoice => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.getLightningSendFeeEstimate({
      encodedInvoice: invoice,
    });
  } catch (err) {
    console.log('Get lightning payment fee error', err);
  }
};

export const getSparkBitcoinPaymentRequest = async paymentId => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.getCoopExitRequest(paymentId);
  } catch (err) {
    console.log('Get bitcoin payment fee estimate error', err);
  }
};

export const getSparkBitcoinPaymentFeeEstimate = async ({
  amountSats,
  withdrawalAddress,
}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.getCoopExitFeeEstimate({
      amountSats,
      withdrawalAddress,
    });
  } catch (err) {
    console.log('Get bitcoin payment fee estimate error', err);
  }
};

export const getSparkPaymentFeeEstimate = async amountSats => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const feeResponse = await sparkWallet.getSwapFeeEstimate(amountSats);
    return feeResponse.feeEstimate.originalValue || SPARK_TO_SPARK_FEE;
  } catch (err) {
    console.log('Get bitcoin payment fee estimate error', err);
  }
};

export const receiveSparkLightningPayment = async ({amountSats, memo}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.createLightningInvoice({amountSats, memo});
  } catch (err) {
    console.log('Receive lightning payment error', err);
  }
};
export const getSparkLightningSendRequest = async id => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.getLightningSendRequest(id);
  } catch (err) {
    console.log('Get spark lightning send request error', err);
  }
};

export const getSparkLightningPaymentStatus = async ({lightningInvoiceId}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.getLightningReceiveRequest(lightningInvoiceId);
  } catch (err) {
    console.log('Get lightning payment status error', err);
  }
};

export const sendSparkLightningPayment = async ({invoice, maxFeeSats}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const paymentResponse = await sparkWallet.payLightningInvoice({invoice});
    return {didWork: true, paymentResponse};
  } catch (err) {
    console.log('Send lightning payment error', err);
    return {didWork: false, error: err.message};
  }
};
export const sendSparkBitcoinPayment = async ({
  onchainAddress,
  exitSpeed,
  amountSats,
}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.withdraw({
      onchainAddress,
      exitSpeed,
      amountSats,
    });
  } catch (err) {
    console.log('Send Bitcoin payment error', err);
  }
};

export const getSparkTransactions = async (
  transferCount = 100,
  offsetIndex,
) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.getTransfers(transferCount, offsetIndex);
  } catch (err) {
    console.log('get spark transactions error', err);
  }
};
export const getCachedSparkTransactions = async () => {
  try {
    const txResponse = await getAllSparkTransactions();
    if (!txResponse) throw new Error('Unable to get cached spark transactins');
    return txResponse;
  } catch (err) {
    console.log('get cached spark transaction error', err);
  }
};
export const sparkPaymentType = tx => {
  try {
    const isLightningPayment = tx.type === 'PREIMAGE_SWAP';
    const isBitcoinPayment = tx.type == 'COOPERATIVE_EXIT';
    const isSparkPayment = tx.type === 'TRANSFER';

    return isLightningPayment
      ? 'lightning'
      : isBitcoinPayment
      ? 'bitcoin'
      : 'spark';
  } catch (err) {
    console.log('Error finding which payment method was used', err);
  }
};

export const getSparkPaymentStatus = status => {
  return status === 'TRANSFER_STATUS_COMPLETED'
    ? 'completed'
    : status === 'TRANSFER_STATUS_RETURNED' ||
      status === 'TRANSFER_STATUS_EXPIRED'
    ? 'failed'
    : 'pending';
};

export const useIsSparkPaymentPending = (tx, transactionPaymentType) => {
  try {
    return (
      (transactionPaymentType === 'bitcoin' &&
        tx.status === 'TRANSFER_STATUS_SENDER_KEY_TWEAK_PENDING') ||
      (transactionPaymentType === 'spark' && false) ||
      (transactionPaymentType === 'lightning' &&
        tx.status === 'LIGHTNING_PAYMENT_INITIATED')
    );
  } catch (err) {
    console.log('Error finding is payment method is pending', err);
    return '';
  }
};

export const useIsSparkPaymentFailed = (tx, transactionPaymentType) => {
  try {
    return (
      (transactionPaymentType === 'bitcoin' &&
        tx.status === 'TRANSFER_STATUS_RETURNED') ||
      (transactionPaymentType === 'spark' &&
        tx.status === 'TRANSFER_STATUS_RETURNED') ||
      (transactionPaymentType === 'lightning' &&
        tx.status === 'LIGHTNING_PAYMENT_INITIATED')
    );
  } catch (err) {
    console.log('Error finding is payment method is pending', err);
    return '';
  }
};

export const isSparkDonationPayment = (currentTx, currentTxDetails) => {
  try {
    return (
      currentTxDetails.direction === 'OUTGOING' &&
      currentTx === 'spark' &&
      currentTxDetails.address === process.env.BLITZ_SPARK_SUPPORT_ADDRESSS &&
      currentTxDetails.receiverPubKey === process.env.BLITZ_SPARK_PUBLICKEY
    );
  } catch (err) {
    console.log('Error finding is payment method is pending', err);
    return false;
  }
};
