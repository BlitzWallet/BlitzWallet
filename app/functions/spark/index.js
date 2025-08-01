import {
  SparkWallet,
  ReactNativeSparkSigner,
  getLatestDepositTxId,
} from '@buildonspark/spark-sdk/native';
import {
  LightningSendRequestStatus,
  SparkCoopExitRequestStatus,
  LightningReceiveRequestStatus,
  SparkLeavesSwapRequestStatus,
  SparkUserRequestStatus,
  ClaimStaticDepositStatus,
} from '@buildonspark/spark-sdk/types';
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
    return {isConnected: false, error: err.message};
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
// export const initializeTempSparkWallet = async mnemoinc => {
//   try {
//     const {wallet: w} = await SparkWallet.initialize({
//       signer: new ReactNativeSparkSigner(),
//       mnemonicOrSeed: mnemoinc,
//       options: {network: 'MAINNET'},
//     });

//     return w;
//   } catch (err) {
//     console.log('Initialize spark wallet error', err);
//   }
// };

export const getSparkBalance = async () => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const balance = await sparkWallet.getBalance();
    console.log('Spark Balance:', balance);
    console.log('Tokens balance size:', balance.tokenBalances.size);
    console.log(
      'Tokens balance keys',
      Array.from(balance.tokenBalances.keys()),
    );
    console.log(
      'Tokens balance values',
      Array.from(balance.tokenBalances.values()),
    );
    let tokensObj = {};

    for (const [tokensIdentifier, tokensBalane] of balance.tokenBalances) {
      tokensObj[tokensIdentifier] = tokensBalane;
      console.log('Tokens Identifier', tokensIdentifier);
      console.log('Tokens Balance:', tokensBalane);
    }
    return {tokensObj, balance: balance.balance, didWork: true};
  } catch (err) {
    console.log('Get spark balance error', err);
    return {didWork: false};
  }
};

// export const getSparkBitcoinL1Address = async () => {
//   try {
//     if (!sparkWallet) throw new Error('sparkWallet not initialized');
//     return await sparkWallet.getSingleUseDepositAddress();
//   } catch (err) {
//     console.log('Get Bitcoin mainchain address error', err);
//   }
// };

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
    const response = await sparkWallet.claimStaticDeposit({
      creditAmountSats,
      sspSignature,
      transactionId,
    });
    return {didWork: true, response};
  } catch (err) {
    console.log('claim static deposit address error', err);
    return {didWork: false, error: err.message};
  }
};

// export const getUnusedSparkBitcoinL1Address = async () => {
//   try {
//     if (!sparkWallet) throw new Error('sparkWallet not initialized');
//     return (await sparkWallet.getUnusedDepositAddresses()) || [];
//   } catch (err) {
//     console.log('Get Bitcoin mainchain address error', err);
//   }
// };

// export const querySparkBitcoinL1Transaction = async depositAddress => {
//   try {
//     if (!sparkWallet) throw new Error('sparkWallet not initialized');
//     return await getLatestDepositTxId(depositAddress);
//   } catch (err) {
//     console.log('Get latest deposit address information error', err);
//   }
// };

// export const claimSparkBitcoinL1Transaction = async depositAddress => {
//   try {
//     if (!sparkWallet) throw new Error('sparkWallet not initialized');
//     const txId = await querySparkBitcoinL1Transaction(depositAddress);
//     const claimResponse = await (txId
//       ? sparkWallet.claimDeposit(txId)
//       : Promise.resolve(null));
//     return [txId, claimResponse];
//   } catch (err) {
//     console.log('Claim bitcoin mainnet payment error', err);
//   }
// };

export const getSparkAddress = async () => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const response = await sparkWallet.getSparkAddress();
    return {didWork: true, response};
  } catch (err) {
    console.log('Get spark address error', err);
    return {didWork: false, error: err.message};
  }
};

export const sendSparkPayment = async ({receiverSparkAddress, amountSats}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const response = await sparkWallet.transfer({
      receiverSparkAddress: receiverSparkAddress.toLowerCase(),
      amountSats,
    });
    console.log('spark payment response', response);
    return {didWork: true, response};
  } catch (err) {
    console.log('Send spark payment error', err);
    return {didWork: false, error: err.message};
  }
};

export const sendSparkTokens = async ({
  tokenIdentifier,
  tokenAmount,
  receiverSparkAddress,
}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const response = await sparkWallet.transferTokens({
      tokenIdentifier,
      tokenAmount: BigInt(tokenAmount),
      receiverSparkAddress,
    });
    return {didWork: true, response};
  } catch (err) {
    console.log('Send spark token error', err);
    return {didWork: false, error: err.message};
  }
};

export const getSparkLightningPaymentFeeEstimate = async (
  invoice,
  amountSat,
) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const response = await sparkWallet.getLightningSendFeeEstimate({
      encodedInvoice: invoice.toLowerCase(),
      amountSats: amountSat,
    });
    return {didWork: true, response};
  } catch (err) {
    console.log('Get lightning payment fee error', err);
    return {didWork: false, error: err.message};
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
    const response = await sparkWallet.getWithdrawalFeeQuote({
      amountSats,
      withdrawalAddress: withdrawalAddress.toLowerCase(),
    });
    return {didWork: true, response};
  } catch (err) {
    console.log('Get bitcoin payment fee estimate error', err);
    return {didWork: false, error: err.message};
  }
};

export const getSparkPaymentFeeEstimate = async amountSats => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const feeResponse = await sparkWallet.getSwapFeeEstimate(amountSats);
    return feeResponse.feeEstimate.originalValue || SPARK_TO_SPARK_FEE;
  } catch (err) {
    console.log('Get bitcoin payment fee estimate error', err);
    return SPARK_TO_SPARK_FEE;
  }
};

export const receiveSparkLightningPayment = async ({amountSats, memo}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const response = await sparkWallet.createLightningInvoice({
      amountSats,
      memo,
      expirySeconds: 60 * 60 * 12, // 12 hour invoice expiry
    });
    return {didWork: true, response};
  } catch (err) {
    console.log('Receive lightning payment error', err);
    return {didWork: false, error: err.message};
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

export const sendSparkLightningPayment = async ({
  invoice,
  maxFeeSats,
  amountSats,
}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const paymentResponse = await sparkWallet.payLightningInvoice({
      invoice: invoice.toLowerCase(),
      maxFeeSats: maxFeeSats,
      amountSatsToSend: amountSats,
    });
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
  feeQuote,
  deductFeeFromWithdrawalAmount = false,
}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    const response = await sparkWallet.withdraw({
      onchainAddress: onchainAddress.toLowerCase(),
      exitSpeed,
      amountSats,
      feeQuote,
      deductFeeFromWithdrawalAmount,
    });
    return {didWork: true, response};
  } catch (err) {
    console.log('Send Bitcoin payment error', err);
    return {didWork: false, error: err.message};
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
    return {transfers: []};
  }
};

export const getSparkTokenTransactions = async ({
  ownerPublicKeys,
  issuerPublicKeys,
  tokenTransactionHashes,
  tokenIdentifiers,
  outputIds,
}) => {
  try {
    if (!sparkWallet) throw new Error('sparkWallet not initialized');
    return await sparkWallet.queryTokenTransactions({
      ownerPublicKeys,
      issuerPublicKeys,
      tokenTransactionHashes,
      tokenIdentifiers,
      outputIds,
    });
  } catch (err) {
    console.log('get spark transactions error', err);
    return [];
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
    const isBitcoinPayment =
      tx.type == 'COOPERATIVE_EXIT' || tx.type === 'UTXO_SWAP';
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
  return status === 'TRANSFER_STATUS_COMPLETED' ||
    status === LightningSendRequestStatus.TRANSFER_COMPLETED ||
    status === SparkCoopExitRequestStatus.SUCCEEDED ||
    status === LightningReceiveRequestStatus.TRANSFER_COMPLETED ||
    status === SparkLeavesSwapRequestStatus.SUCCEEDED ||
    status === SparkUserRequestStatus.SUCCEEDED ||
    status === ClaimStaticDepositStatus.TRANSFER_COMPLETED
    ? 'completed'
    : status === 'TRANSFER_STATUS_RETURNED' ||
      status === 'TRANSFER_STATUS_EXPIRED' ||
      status === 'TRANSFER_STATUS_SENDER_INITIATED' ||
      status === LightningSendRequestStatus.LIGHTNING_PAYMENT_FAILED ||
      status === SparkCoopExitRequestStatus.FAILED ||
      status === SparkCoopExitRequestStatus.EXPIRED ||
      status === LightningReceiveRequestStatus.TRANSFER_FAILED ||
      status ===
        LightningReceiveRequestStatus.PAYMENT_PREIMAGE_RECOVERING_FAILED ||
      status ===
        LightningReceiveRequestStatus.REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED ||
      status === LightningReceiveRequestStatus.REFUND_SIGNING_FAILED ||
      status === SparkLeavesSwapRequestStatus.FAILED ||
      status === SparkLeavesSwapRequestStatus.EXPIRED ||
      status === SparkUserRequestStatus.FAILED ||
      status === ClaimStaticDepositStatus.TRANSFER_CREATION_FAILED ||
      status === ClaimStaticDepositStatus.REFUND_SIGNING_FAILED ||
      status === ClaimStaticDepositStatus.UTXO_SWAPPING_FAILED
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

export const findTransactionTxFromTxHistory = async (
  sparkTxId,
  previousOffset = 0,
  previousTxs = [],
) => {
  try {
    // First check cached transactions
    const cachedTx = previousTxs.find(tx => tx.id === sparkTxId);
    if (cachedTx) {
      console.log('Using cache tx history');
      return {
        didWork: true,
        offset: previousOffset,
        foundTransfers: previousTxs,
        bitcoinTransfer: cachedTx,
      };
    }

    let offset = previousOffset;
    let foundTransfers = [];
    let bitcoinTransfer = undefined;
    const maxAttempts = 20;
    while (offset < maxAttempts) {
      const transfers = await getSparkTransactions(100, 100 * offset);
      foundTransfers = transfers.transfers;

      if (!foundTransfers.length) {
        break;
      }

      const includesTx = foundTransfers.find(tx => tx.id === sparkTxId);
      if (includesTx) {
        bitcoinTransfer = includesTx;
        break;
      }

      if (transfers.offset === -1) {
        console.log('Reached end of transactions (offset: -1)');
        break;
      }

      offset += 1;
    }

    return {didWork: true, offset, foundTransfers, bitcoinTransfer};
  } catch (err) {
    console.log('Error finding bitcoin tx from history', err);
    return {didWork: false, error: err.message};
  }
};
