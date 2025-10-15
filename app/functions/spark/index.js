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
import {
  getHandshakeComplete,
  sendWebViewRequestGlobal,
  setForceReactNative,
} from '../../../context-store/webViewContext';

export let sparkWallet = {};
let initializingWallets = {};

// Hash cache to avoid recalculating hashes
const mnemonicHashCache = new Map();

const getMnemonicHash = mnemonic => {
  if (!mnemonicHashCache.has(mnemonic)) {
    mnemonicHashCache.set(mnemonic, sha256Hash(mnemonic));
  }
  return mnemonicHashCache.get(mnemonic);
};

const getWallet = async mnemonic => {
  const hash = getMnemonicHash(mnemonic);
  let wallet = sparkWallet[hash];

  if (!wallet) {
    if (initializingWallets[hash]) {
      await initializingWallets[hash];
      return sparkWallet[hash];
    }
    console.log('Creating native wallet because none exists');
    initializingWallets[hash] = initializeWallet(mnemonic);
    wallet = await initializingWallets[hash];
    sparkWallet[hash] = wallet;
    delete initializingWallets[hash]; // cleanup after done
  }

  return wallet;
};

let forceUseOfNativeRuntime = null;
/**
 * Determines which runtime to use for Spark functions.
 * @param {string} mnemonic - user mnemonic
 * @param {boolean} isInitialLoad - true only on first connection attempt
 * @param {boolean?} force - optional force to native runtime
 * @returns { 'native' | 'webview' }
 */
export const selectSparkRuntime = async (
  mnemonic,
  isInitialLoad = false,
  force = undefined,
) => {
  // Force native runtime explicitly
  if (isInitialLoad && force) {
    forceUseOfNativeRuntime = true;
  }

  if (forceUseOfNativeRuntime) {
    return 'native';
  }

  const handshakeDone = getHandshakeComplete();

  if (handshakeDone) {
    return 'webview';
  }

  // Handshake not done → fallback to native
  const walletHash = getMnemonicHash(mnemonic);
  if (!sparkWallet[walletHash]) {
    await getWallet(mnemonic);
  }

  return 'native';
};

// Clear cache when needed (call this on logout/cleanup)
export const clearMnemonicCache = () => {
  mnemonicHashCache.clear();
  sparkWallet = {};
};

export const initializeSparkWallet = async (mnemonic, isInitialLoad = true) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic, isInitialLoad);

    if (runtime === 'webview') {
      // Use WebView to initialize wallet
      const response = await sendWebViewRequestGlobal('initializeSparkWallet', {
        mnemonic,
      });

      if (response?.isConnected) return response;
    }

    const hash = getMnemonicHash(mnemonic);

    // Early return if already initialized
    if (sparkWallet[hash]) {
      return { isConnected: true };
    }
    if (initializingWallets[hash]) {
      await initializingWallets[hash];
      return { isConnected: true };
    }
    initializingWallets[hash] = (async () => {
      const wallet = await initializeWallet(mnemonic);
      sparkWallet[hash] = wallet;
      delete initializingWallets[hash]; // cleanup after done
    })();

    await initializingWallets[hash];
    setForceReactNative(true);

    return { isConnected: true };
  } catch (err) {
    console.log('Initialize spark wallet error:', err);
    return { isConnected: false, error: err.message };
  }
};

const initializeWallet = async mnemonic => {
  const { wallet } = await SparkWallet.initialize({
    signer: new ReactNativeSparkSigner(),
    mnemonicOrSeed: mnemonic,
    options: {
      network: 'MAINNET',
      optimizationOptions: {
        multiplicity: 2,
      },
    },
  });

  console.log('did initialize wallet');
  return wallet;
};

export const getSparkIdentityPubKey = async (mnemonic, sendWebViewRequest) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'getSparkIdentityPubKey',
        {
          mnemonic,
        },
      );
      if (!response) throw new Error('unable to generate spak identity pubkey');
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      return await wallet.getIdentityPublicKey();
    }
  } catch (err) {
    console.log('Get spark balance error', err);
  }
};

export const getSparkBalance = async mnemonic => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    const hash = getMnemonicHash(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal('getSparkBalance', {
        mnemonic,
      });
      if (!response.didWork) throw new Error('unable to get balance');
      const balanceString = response.balance;
      const tokensObject = response.tokensObject;

      const balance = BigInt(balanceString);

      const convertedTokensObj = {};
      for (const [tokensIdentifier, tokensData] of Object.entries(
        tokensObject,
      )) {
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

      const cachedTokens = await migrateCachedTokens(mnemonic);

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
    } else {
      const wallet = await getWallet(mnemonic);
      const balance = await wallet.getBalance();
      const cachedTokens = await migrateCachedTokens(mnemonic);

      let currentTokensObj = {};
      for (const [tokensIdentifier, tokensData] of balance.tokenBalances) {
        currentTokensObj[tokensIdentifier] = tokensData;
      }

      const allTokens = mergeTokensWithCache(
        currentTokensObj,
        cachedTokens,
        mnemonic,
      );

      await saveCachedTokens(allTokens);

      return {
        tokensObj: allTokens[hash],
        balance: balance.balance,
        didWork: true,
      };
    }
  } catch (err) {
    console.log('Get spark balance error', err);
    return { didWork: false };
  }
};

export const getSparkStaticBitcoinL1Address = async mnemonic => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'getSparkStaticBitcoinL1Address',
        { mnemonic },
      );
      if (!response)
        throw new Error('Not abler to generate bitcoin l1 daddress');
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      return await wallet.getStaticDepositAddress();
    }
  } catch (err) {
    console.log('Get reusable Bitcoin mainchain address error', err);
  }
};

export const queryAllStaticDepositAddresses = async mnemonic => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'queryAllStaticDepositAddresses',
        { mnemonic },
      );
      if (!response) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      return wallet.queryStaticDepositAddresses();
    }
  } catch (err) {
    console.log('refund reusable Bitcoin mainchain address error', err);
  }
};

export const getSparkStaticBitcoinL1AddressQuote = async (txid, mnemonic) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'getSparkStaticBitcoinL1AddressQuote',
        { mnemonic, txid },
      );
      if (!response.didWork) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      const quote = await wallet.getClaimStaticDepositQuote(txid);
      return { didWork: true, quote };
    }
  } catch (err) {
    console.log('Get reusable Bitcoin mainchain address quote error', err);
    return { didWork: false, error: err.message };
  }
};

export const refundSparkStaticBitcoinL1AddressQuote = async ({
  depositTransactionId,
  destinationAddress,
  fee,
  mnemonic,
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      return await getWallet(mnemonic).refundStaticDeposit({
        depositTransactionId,
        destinationAddress,
        fee,
      });
    } else {
      const wallet = await getWallet(mnemonic);
      return await wallet.refundStaticDeposit({
        depositTransactionId,
        destinationAddress,
        fee,
      });
    }
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
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'claimnSparkStaticDepositAddress',
        { mnemonic, creditAmountSats, sspSignature, transactionId },
      );
      if (!response.didWork) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      const response = await wallet.claimStaticDeposit({
        creditAmountSats,
        sspSignature,
        transactionId,
      });
      return { didWork: true, response };
    }
  } catch (err) {
    console.log('claim static deposit address error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkAddress = async mnemonic => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal('getSparkAddress', {
        mnemonic,
      });
      if (!response.didWork) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      const response = await wallet.getSparkAddress();
      return { didWork: true, response };
    }
  } catch (err) {
    console.log('Get spark address error', err);
    return { didWork: false, error: err.message };
  }
};

export const sendSparkPayment = async ({
  receiverSparkAddress,
  amountSats,
  mnemonic,
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal('sendSparkPayment', {
        mnemonic,
        receiverSparkAddress,
        amountSats,
      });
      if (!response.didWork) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      const response = await wallet.transfer({
        receiverSparkAddress: receiverSparkAddress.toLowerCase(),
        amountSats,
      });
      return { didWork: true, response };
    }
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
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal('sendSparkTokens', {
        mnemonic,
        tokenIdentifier,
        tokenAmount,
        receiverSparkAddress,
      });
      if (!response.didWork) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      const response = await wallet.transferTokens({
        tokenIdentifier,
        tokenAmount: BigInt(tokenAmount),
        receiverSparkAddress,
      });
      return { didWork: true, response };
    }
  } catch (err) {
    console.log('Send spark token error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkLightningPaymentFeeEstimate = async (
  invoice,
  amountSat,
  mnemonic,
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'getSparkLightningPaymentFeeEstimate',
        {
          mnemonic,
          amountSat,
          invoice,
        },
      );
      if (!response.didWork) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      const response = await wallet.getLightningSendFeeEstimate({
        encodedInvoice: invoice.toLowerCase(),
        amountSats: amountSat,
      });
      return { didWork: true, response };
    }
  } catch (err) {
    console.log('Get lightning payment fee error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkBitcoinPaymentRequest = async (paymentId, mnemonic) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'getSparkBitcoinPaymentRequest',
        {
          mnemonic,
          paymentId,
        },
      );
      if (!response) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      return await wallet.getCoopExitRequest(paymentId);
    }
  } catch (err) {
    console.log('Get bitcoin payment fee estimate error', err);
  }
};

export const getSparkBitcoinPaymentFeeEstimate = async ({
  amountSats,
  withdrawalAddress,
  mnemonic,
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'getSparkBitcoinPaymentFeeEstimate',
        {
          mnemonic,
          amountSats,
          withdrawalAddress,
        },
      );
      if (!response.didWork) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      const response = await wallet.getWithdrawalFeeQuote({
        amountSats,
        withdrawalAddress: withdrawalAddress,
      });
      return { didWork: true, response };
    }
  } catch (err) {
    console.log('Get bitcoin payment fee estimate error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkPaymentFeeEstimate = async (amountSats, mnemonic) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'getSparkPaymentFeeEstimate',
        {
          mnemonic,
          amountSats,
        },
      );
      if (!response) throw new Error(response.error);
      const amount = response.feeEstimate.originalValue;
      return amount;
    } else {
      const wallet = await getWallet(mnemonic);
      const feeResponse = await wallet.getSwapFeeEstimate(amountSats);
      return feeResponse.feeEstimate.originalValue || SPARK_TO_SPARK_FEE;
    }
  } catch (err) {
    console.log('Get bitcoin payment fee estimate error', err);
    return SPARK_TO_SPARK_FEE;
  }
};

export const receiveSparkLightningPayment = async ({
  amountSats,
  memo,
  mnemonic,
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'receiveSparkLightningPayment',
        {
          mnemonic,
          amountSats,
          memo,
          expirySeconds: 60 * 60 * 12,
        },
      );
      if (!response.didWork) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      const response = await wallet.createLightningInvoice({
        amountSats,
        memo,
        expirySeconds: 60 * 60 * 12, // 12 hour invoice expiry
      });
      return { didWork: true, response };
    }
  } catch (err) {
    console.log('Receive lightning payment error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkLightningSendRequest = async (id, mnemonic) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'getSparkLightningSendRequest',
        {
          mnemonic,
          id,
        },
      );
      if (!response) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      return await wallet.getLightningSendRequest(id);
    }
  } catch (err) {
    console.log('Get spark lightning send request error', err);
  }
};

export const getSparkLightningPaymentStatus = async ({
  lightningInvoiceId,
  mnemonic,
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'getSparkLightningPaymentStatus',
        {
          mnemonic,
          lightningInvoiceId,
        },
      );
      if (!response) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      return await wallet.getLightningReceiveRequest(lightningInvoiceId);
    }
  } catch (err) {
    console.log('Get lightning payment status error', err);
  }
};

export const sendSparkLightningPayment = async ({
  invoice,
  maxFeeSats,
  amountSats,
  mnemonic,
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'sendSparkLightningPayment',
        {
          mnemonic,
          invoice,
          maxFeeSats,
          amountSat: amountSats,
        },
      );
      if (!response.didWork) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      const paymentResponse = await wallet.payLightningInvoice({
        invoice: invoice.toLowerCase(),
        maxFeeSats: maxFeeSats,
        amountSatsToSend: amountSats,
      });
      return { didWork: true, paymentResponse };
    }
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
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'sendSparkBitcoinPayment',
        {
          mnemonic,
          onchainAddress,
          exitSpeed,
          feeQuote,
          amountSats,
          deductFeeFromWithdrawalAmount,
        },
      );
      if (!response.didWork) throw new Error(response.error);
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      const response = await wallet.withdraw({
        onchainAddress: onchainAddress,
        exitSpeed,
        amountSats,
        feeQuote,
        deductFeeFromWithdrawalAmount,
      });
      return { didWork: true, response };
    }
  } catch (err) {
    console.log('Send Bitcoin payment error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkTransactions = async (
  transferCount = 100,
  offsetIndex,
  mnemonic,
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal('getSparkTransactions', {
        mnemonic,
        transferCount,
        offsetIndex,
      });
      if (!response) throw new Error('unable to get trasnactions');
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      return await wallet.getTransfers(transferCount, offsetIndex);
    }
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
  lastSavedTransactionId,
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        'getSparkTokenTransactions',
        {
          mnemonic,
          ownerPublicKeys,
          issuerPublicKeys,
          tokenTransactionHashes,
          tokenIdentifiers,
          outputIds,
          lastSavedTransactionId,
        },
      );
      if (!response) throw new Error('unable to get trasnactions');
      return response;
    } else {
      const wallet = await getWallet(mnemonic);
      const response = await wallet.queryTokenTransactions({
        ownerPublicKeys,
        issuerPublicKeys,
        tokenTransactionHashes,
        tokenIdentifiers,
        outputIds,
      });
      let filteredTransactions = response.tokenTransactionsWithStatus;
      if (lastSavedTransactionId) {
        const lastIndex = response.tokenTransactionsWithStatus.findIndex(
          tx =>
            Buffer.from(Object.values(tx.tokenTransactionHash)).toString(
              'hex',
            ) === lastSavedTransactionId,
        );

        if (lastIndex !== -1) {
          filteredTransactions = response.tokenTransactionsWithStatus.slice(
            0,
            lastIndex,
          );
        }
      }
      return {
        tokenTransactionsWithStatus: filteredTransactions,
        offset: response.offset,
      };
    }
  } catch (err) {
    console.log('get spark Tokens transactions error', err);
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

export const addSparkListener = async (mnemonic, transferHandler) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'native') {
      const wallet = await getWallet(mnemonic);
      wallet?.on('transfer:claimed', transferHandler);
    } else {
      await sendWebViewRequestGlobal('addWalletEventListener', {
        mnemonic: mnemonic,
      });
    }
  } catch (err) {
    console.log('error adding spark listeners', err);
  }
};
export const removeSparkListeners = async mnemonic => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'native') {
      const wallet = await getWallet(mnemonic);
      if (mnemonic && wallet?.listenerCount('transfer:claimed')) {
        wallet?.removeAllListeners('transfer:claimed');
      }
    } else {
      sendWebViewRequestGlobal('removeWalletEventListener', {
        mnemonic: prevAccountMnemoincRef.current,
      });
    }
  } catch (err) {
    console.log('error removing spark listenres', err);
  }
};

export const sparkPaymentType = tx => {
  try {
    const isLightningPayment = tx.type === 'PREIMAGE_SWAP';
    const isBitcoinPayment =
      tx.type === 'COOPERATIVE_EXIT' || tx.type === 'UTXO_SWAP';
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
  transferCount = 100,
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
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
    let bitcoinTransfer;
    const maxAttempts = 20;
    let wallet;
    if (runtime === 'native') {
      wallet = await getWallet(mnemonic);
    }

    while (offset < maxAttempts) {
      let transfers;
      if (runtime === 'webview') {
        transfers = await sendWebViewRequestGlobal('getSparkTransactions', {
          mnemonic,
          transferCount: transferCount,
          offsetIndex: transferCount * offset,
        });
      } else {
        transfers = await wallet.getTransfers(
          transferCount,
          transferCount * offset,
        );
      }

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
