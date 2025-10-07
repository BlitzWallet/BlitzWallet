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
import { getAllSparkTransactions } from './transactions';
import { SPARK_TO_SPARK_FEE } from '../../constants/math';
import {
  getCachedTokens,
  mergeTokensWithCache,
  migrateCachedTokens,
  saveCachedTokens,
} from '../lrc20/cachedTokens';
import sha256Hash from '../hash';

export let sparkWallet = {};

// Hash cache to avoid recalculating hashes
const mnemonicHashCache = new Map();

const getMnemonicHash = mnemonic => {
  if (!mnemonicHashCache.has(mnemonic)) {
    mnemonicHashCache.set(mnemonic, sha256Hash(mnemonic));
  }
  return mnemonicHashCache.get(mnemonic);
};

// Centralizes wallet lookup and error handling, reducing code duplication
const getWallet = mnemonic => {
  const hash = getMnemonicHash(mnemonic);
  const wallet = sparkWallet[hash];

  if (!wallet) {
    throw new Error('sparkWallet not initialized');
  }

  return wallet;
};

// Clear cache when needed (call this on logout/cleanup)
export const clearMnemonicCache = () => {
  mnemonicHashCache.clear();
};

export const initializeSparkWallet = async (mnemonic, sendWebViewRequest) => {
  try {
    const response = await sendWebViewRequest('initializeSparkWallet', {
      mnemonic,
    });
    if (!response.isConnected) throw new Error(response.error);
    return response;
    const hash = getMnemonicHash(mnemonic);

    // Early return if already initialized
    if (sparkWallet[hash]) {
      return { isConnected: true };
    }

    const { wallet } = await SparkWallet.initialize({
      signer: new ReactNativeSparkSigner(),
      mnemonicOrSeed: mnemonic,
      options: { network: 'MAINNET' },
    });

    sparkWallet[hash] = wallet;
    return { isConnected: true };
  } catch (err) {
    console.log('Initialize spark wallet error function', err);
    return { isConnected: false, error: err.message };
  }
};

export const getSparkIdentityPubKey = async (mnemonic, sendWebViewRequest) => {
  try {
    const response = await sendWebViewRequest('getSparkIdentityPubKey', {
      mnemonic,
    });
    if (!response) throw new Error('unable to generate spak identity pubkey');
    return response;
    // Now uses optimized getWallet helper
    return await getWallet(mnemonic).getIdentityPublicKey();
  } catch (err) {
    console.log('Get spark balance error', err);
  }
};

export const getSparkBalance = async (mnemonic, sendWebViewRequest) => {
  try {
    const response = await sendWebViewRequest('getSparkBalance', { mnemonic });

    if (!response.didWork) throw new Error('unable to get balance');

    const balanceString = response.balance; // balance as string
    const tokensObject = response.tokensObject; // plain object from WebView
    console.log(balanceString, tokensObject);
    // Convert balances back to BigInt
    const balance = BigInt(balanceString);

    const convertedTokensObj = {};
    for (const [tokensIdentifier, tokensData] of Object.entries(tokensObject)) {
      console.log(tokensIdentifier, tokensData);
      convertedTokensObj[tokensIdentifier] = {
        ...tokensData,
        balance: BigInt(tokensData.balance),
        tokenMetadata: {
          ...tokensData.tokenMetadata,
          maxSupply: BigInt(tokensData.tokenMetadata.maxSupply),
        },
      };
    }
    console.log(convertedTokensObj, 'converted objcet');

    const cachedTokens = await migrateCachedTokens(mnemonic);

    console.log(cachedTokens);

    const hash = getMnemonicHash(mnemonic);
    const allTokens = mergeTokensWithCache(
      convertedTokensObj,
      cachedTokens,
      mnemonic,
    );

    await saveCachedTokens(allTokens);

    return {
      tokensObj: allTokens[hash],
      balance,
      didWork: true,
    };
  } catch (err) {
    console.log('Get spark balance error', err);
    return { didWork: false };
  }
};

export const getSparkStaticBitcoinL1Address = async (
  mnemonic,
  sendWebViewRequest,
) => {
  try {
    const response = await sendWebViewRequest(
      'getSparkStaticBitcoinL1Address',
      { mnemonic },
    );
    if (!response) throw new Error('Not abler to generate bitcoin l1 daddress');
    return response;
    return await getWallet(mnemonic).getStaticDepositAddress();
  } catch (err) {
    console.log('Get reusable Bitcoin mainchain address error', err);
  }
};

export const queryAllStaticDepositAddresses = async (
  mnemonic,
  sendWebViewRequest,
) => {
  try {
    const response = await sendWebViewRequest(
      'queryAllStaticDepositAddresses',
      { mnemonic },
    );
    if (!response) throw new Error(response.error);
    return response;
    return await getWallet(mnemonic).queryStaticDepositAddresses();
  } catch (err) {
    console.log('refund reusable Bitcoin mainchain address error', err);
  }
};

export const getSparkStaticBitcoinL1AddressQuote = async (
  txid,
  mnemonic,
  sendWebViewRequest,
) => {
  try {
    const response = await sendWebViewRequest(
      'getSparkStaticBitcoinL1AddressQuote',
      { mnemonic, txid },
    );
    if (!response.didWork) throw new Error(response.error);
    return response;
    const quote = await getWallet(mnemonic).getClaimStaticDepositQuote(txid);
    return { didwork: true, quote };
  } catch (err) {
    console.log('Get reusable Bitcoin mainchain address quote error', err);
    return { didwork: false, error: err.message };
  }
};

export const refundSparkStaticBitcoinL1AddressQuote = async ({
  depositTransactionId,
  destinationAddress,
  fee,
  mnemonic,
}) => {
  try {
    return await getWallet(mnemonic).refundStaticDeposit({
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
  mnemonic,
  sendWebViewRequest,
}) => {
  try {
    const response = await sendWebViewRequest(
      'getSparkStaticBitcoinL1AddressQuote',
      { mnemonic, creditAmountSats, sspSignature, transactionId },
    );
    if (!response.didWork) throw new Error(response.error);
    return response;
    // const response = await getWallet(mnemonic).claimStaticDeposit({
    //   creditAmountSats,
    //   sspSignature,
    //   transactionId,
    // });
    // return { didWork: true, response };
  } catch (err) {
    console.log('claim static deposit address error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkAddress = async (mnemonic, sendWebViewRequest) => {
  try {
    const response = await sendWebViewRequest('getSparkAddress', { mnemonic });
    if (!response.didWork) throw new Error(response.error);
    return response;
    // getWallet(mnemonic).getSparkAddress();
    // return { didWork: true, response };
  } catch (err) {
    console.log('Get spark address error', err);
    return { didWork: false, error: err.message };
  }
};

export const sendSparkPayment = async ({
  receiverSparkAddress,
  amountSats,
  mnemonic,
  sendWebViewRequest,
}) => {
  try {
    const response = await sendWebViewRequest('sendSparkPayment', {
      mnemonic,
      receiverSparkAddress,
      amountSats,
    });
    if (!response.didWork) throw new Error(response.error);
    return response;
    // const response = await getWallet(mnemonic).transfer({
    //   receiverSparkAddress: receiverSparkAddress.toLowerCase(),
    //   amountSats,
    // });
    // console.log('spark payment response', response);
    // return { didWork: true, response };
  } catch (err) {
    console.log('Send spark payment error', err);
    return { didWork: false, error: err.message };
  }
};

export const sendSparkTokens = async ({
  tokenIdentifier,
  tokenAmount,
  receiverSparkAddress,
  mnemonic,
  sendWebViewRequest,
}) => {
  try {
    const response = await sendWebViewRequest('sendSparkTokens', {
      mnemonic,
      tokenIdentifier,
      tokenAmount,
      receiverSparkAddress,
    });
    if (!response.didWork) throw new Error(response.error);
    return response;
    // const response = await getWallet(mnemonic).transferTokens({
    //   tokenIdentifier,
    //   tokenAmount: BigInt(tokenAmount),
    //   receiverSparkAddress,
    // });
    // return { didWork: true, response };
  } catch (err) {
    console.log('Send spark token error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkLightningPaymentFeeEstimate = async (
  invoice,
  amountSat,
  mnemonic,
  sendWebViewRequest,
) => {
  try {
    const response = await sendWebViewRequest(
      'getSparkLightningPaymentFeeEstimate',
      {
        mnemonic,
        amountSat,
        invoice,
      },
    );
    if (!response.didWork) throw new Error(response.error);
    return response;
    // const response = await getWallet(mnemonic).getLightningSendFeeEstimate({
    //   encodedInvoice: invoice.toLowerCase(),
    //   amountSats: amountSat,
    // });
    // return { didWork: true, response };
  } catch (err) {
    console.log('Get lightning payment fee error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkBitcoinPaymentRequest = async (
  paymentId,
  mnemonic,
  sendWebViewRequest,
) => {
  try {
    const response = await sendWebViewRequest('getSparkBitcoinPaymentRequest', {
      mnemonic,
      paymentId,
    });
    if (!response) throw new Error(response.error);
    return response;
    return await getWallet(mnemonic).getCoopExitRequest(paymentId);
  } catch (err) {
    console.log('Get bitcoin payment fee estimate error', err);
  }
};

export const getSparkBitcoinPaymentFeeEstimate = async ({
  amountSats,
  withdrawalAddress,
  mnemonic,
  sendWebViewRequest,
}) => {
  try {
    const response = await sendWebViewRequest(
      'getSparkBitcoinPaymentFeeEstimate',
      {
        mnemonic,
        amountSats,
        withdrawalAddress,
      },
    );
    if (!response.didWork) throw new Error(response.error);
    return response;
    // const response = await getWallet(mnemonic).getWithdrawalFeeQuote({
    //   amountSats,
    //   withdrawalAddress: withdrawalAddress,
    // });
    // return { didWork: true, response };
  } catch (err) {
    console.log('Get bitcoin payment fee estimate error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkPaymentFeeEstimate = async (
  amountSats,
  mnemonic,
  sendWebViewRequest,
) => {
  try {
    const response = await sendWebViewRequest('getSparkPaymentFeeEstimate', {
      mnemonic,
      amountSats,
    });
    if (!response) throw new Error(response.error);
    return response;
    // const feeResponse = await getWallet(mnemonic).getSwapFeeEstimate(
    //   amountSats,
    // );
    // return feeResponse.feeEstimate.originalValue || SPARK_TO_SPARK_FEE;
  } catch (err) {
    console.log('Get bitcoin payment fee estimate error', err);
    return SPARK_TO_SPARK_FEE;
  }
};

export const receiveSparkLightningPayment = async ({
  amountSats,
  memo,
  mnemonic,
  sendWebViewRequest,
}) => {
  try {
    const response = await sendWebViewRequest('receiveSparkLightningPayment', {
      mnemonic,
      amountSats,
      memo,
    });
    if (!response.didWork) throw new Error(response.error);
    return response;
    // const response = await getWallet(mnemonic).createLightningInvoice({
    //   amountSats,
    //   memo,
    //   expirySeconds: 60 * 60 * 12, // 12 hour invoice expiry
    // });
    // return { didWork: true, response };
  } catch (err) {
    console.log('Receive lightning payment error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkLightningSendRequest = async (
  id,
  mnemonic,
  sendWebViewRequest,
) => {
  try {
    const response = await sendWebViewRequest('getSparkLightningSendRequest', {
      mnemonic,
      id,
    });
    if (!response) throw new Error(response.error);
    return response;
    // return await getWallet(mnemonic).getLightningSendRequest(id);
  } catch (err) {
    console.log('Get spark lightning send request error', err);
  }
};

export const getSparkLightningPaymentStatus = async ({
  lightningInvoiceId,
  mnemonic,
  sendWebViewRequest,
}) => {
  try {
    const response = await sendWebViewRequest(
      'getSparkLightningPaymentStatus',
      {
        mnemonic,
        lightningInvoiceId,
      },
    );
    if (!response) throw new Error(response.error);
    return response;
    // return await getWallet(mnemonic).getLightningReceiveRequest(
    //   lightningInvoiceId,
    // );
  } catch (err) {
    console.log('Get lightning payment status error', err);
  }
};

export const sendSparkLightningPayment = async ({
  invoice,
  maxFeeSats,
  amountSats,
  mnemonic,
  sendWebViewRequest,
}) => {
  try {
    const response = await sendWebViewRequest('sendSparkLightningPayment', {
      mnemonic,
      invoice,
      maxFeeSats,
      amountSats,
    });
    if (!response.didWork) throw new Error(response.error);
    return response;
    // const paymentResponse = await getWallet(mnemonic).payLightningInvoice({
    //   invoice: invoice.toLowerCase(),
    //   maxFeeSats: maxFeeSats,
    //   amountSatsToSend: amountSats,
    // });
    // return { didWork: true, paymentResponse };
  } catch (err) {
    console.log('Send lightning payment error', err);
    return { didWork: false, error: err.message };
  }
};

export const sendSparkBitcoinPayment = async ({
  onchainAddress,
  exitSpeed,
  amountSats,
  feeQuote,
  deductFeeFromWithdrawalAmount = false,
  mnemonic,
  sendWebViewRequest,
}) => {
  try {
    const response = await sendWebViewRequest('sendSparkBitcoinPayment', {
      mnemonic,
      onchainAddress,
      exitSpeed,
      feeQuote,
      amountSats,
      deductFeeFromWithdrawalAmount,
    });
    if (!response.didWork) throw new Error(response.error);
    return response;
    // const response = await getWallet(mnemonic).withdraw({
    //   onchainAddress: onchainAddress,
    //   exitSpeed,
    //   amountSats,
    //   feeQuote,
    //   deductFeeFromWithdrawalAmount,
    // });
    // return { didWork: true, response };
  } catch (err) {
    console.log('Send Bitcoin payment error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkTransactions = async (
  transferCount = 100,
  offsetIndex,
  mnemonic,
  sendWebViewRequest,
) => {
  try {
    const response = await sendWebViewRequest('getSparkTransactions', {
      mnemonic,
      transferCount,
      offsetIndex,
    });
    if (!response) throw new Error('unable to get trasnactions');
    return response;
    // return await getWallet(mnemonic).getTransfers(transferCount, offsetIndex);
  } catch (err) {
    console.log('get spark transactions error', err);
    return { transfers: [] };
  }
};

export const getSparkTokenTransactions = async ({
  ownerPublicKeys,
  issuerPublicKeys,
  tokenTransactionHashes,
  tokenIdentifiers,
  outputIds,
  mnemonic,
  sendWebViewRequest,
}) => {
  try {
    const response = await sendWebViewRequest('getSparkTokenTransactions', {
      mnemonic,
      ownerPublicKeys,
      issuerPublicKeys,
      tokenTransactionHashes,
      tokenIdentifiers,
      outputIds,
    });
    if (!response) throw new Error('unable to get trasnactions');
    return response;
    // return await getWallet(mnemonic).queryTokenTransactions({
    //   ownerPublicKeys,
    //   issuerPublicKeys,
    //   tokenTransactionHashes,
    //   tokenIdentifiers,
    //   outputIds,
    // });
  } catch (err) {
    console.log('get spark transactions error', err);
    return [];
  }
};

export const getCachedSparkTransactions = async (limit, identifyPubKey) => {
  try {
    const txResponse = await getAllSparkTransactions({
      limit,
      accountId: identifyPubKey,
    });
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
    status === LightningSendRequestStatus.PREIMAGE_PROVIDED ||
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
      status === ClaimStaticDepositStatus.UTXO_SWAPPING_FAILED ||
      status === LightningReceiveRequestStatus.FUTURE_VALUE
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
  mnemonic,
  sendWebViewRequest,
) => {
  try {
    // Early return with cached transaction
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
      const transfers = await getSparkTransactions(
        100,
        100 * offset,
        mnemonic,
        sendWebViewRequest,
      );
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

    return { didWork: true, offset, foundTransfers, bitcoinTransfer };
  } catch (err) {
    console.log('Error finding bitcoin tx from history', err);
    return { didWork: false, error: err.message };
  }
};
