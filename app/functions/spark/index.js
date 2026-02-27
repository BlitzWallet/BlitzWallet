import { SparkWallet, getLatestDepositTxId } from '@buildonspark/spark-sdk';
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
  OPERATION_TYPES,
  sendWebViewRequestGlobal,
  setForceReactNative,
} from '../../../context-store/webViewContext';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';
import {
  deriveSparkAddress,
  deriveSparkIdentityKey,
} from '../gift/deriveGiftWallet';
import { DEFAULT_PAYMENT_EXPIRY_SEC, USDB_TOKEN_ID } from '../../constants';
import { FlashnetClient } from '@flashnet/sdk';

export let sparkWallet = {};
export let flashnetClients = {};
let initializingWallets = {};

// Hash cache to avoid recalculating hashes
const mnemonicHashCache = new Map();

const getMnemonicHash = mnemonic => {
  if (!mnemonicHashCache.has(mnemonic)) {
    mnemonicHashCache.set(mnemonic, sha256Hash(mnemonic));
  }
  return mnemonicHashCache.get(mnemonic);
};

export const getWallet = async mnemonic => {
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

export const getFlashnetClient = mnemonic => {
  const hash = getMnemonicHash(mnemonic);
  const client = flashnetClients[hash];
  if (!client) {
    throw new Error('Flashnet client not initialized');
  }
  return client;
};

/**
 * Determines which runtime to use for Spark functions.
 * Uses getHandshakeComplete() as the single source of truth — it checks
 * both handshakeComplete and forceReactNativeUse internally.
 * @param {string} mnemonic - user mnemonic
 * @param {boolean} isInitialLoad - true only on first connection attempt
 * @param {boolean?} force - optional force to native runtime
 * @returns { 'native' | 'webview' }
 */
export const selectSparkRuntime = async (
  mnemonic,
  isInitialLoad = false,
  force = undefined,
  createNativeWallet = true,
) => {
  // Force native runtime explicitly via the canonical latch
  if (isInitialLoad && force) {
    setForceReactNative(true, 'forced by caller');
  }

  const handshakeDone = getHandshakeComplete();

  if (handshakeDone) {
    return 'webview';
  }

  if (createNativeWallet) {
    // Handshake not done → fallback to native
    const walletHash = getMnemonicHash(mnemonic);
    if (!sparkWallet[walletHash]) {
      await getWallet(mnemonic);
    }
  }

  return 'native';
};

// Clear cache when needed (call this on logout/cleanup)
export const clearMnemonicCache = () => {
  mnemonicHashCache.clear();
  Object.keys(sparkWallet).forEach(key => delete sparkWallet[key]);
};

export const initializeSparkWallet = async (
  mnemonic,
  isInitialLoad = true,
  options = {},
) => {
  const {
    maxRetries = 8,
    retryDelay = 15000, // 15 seconds between retries
    enableRetry = true,
  } = options;

  const attemptInitialization = async (attemptNumber = 0) => {
    try {
      const runtime = await selectSparkRuntime(mnemonic, isInitialLoad);

      if (runtime === 'webview') {
        // Use WebView to initialize wallet
        const response = await sendWebViewRequestGlobal(
          OPERATION_TYPES.initWallet,
          {
            mnemonic,
          },
        );

        if (response?.isConnected) return response;
        else if (
          response.error
            ?.toLowerCase()
            .includes('load failed [endpoint: authenticate')
        )
          throw new Error('Internet error');
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
        try {
          const wallet = await initializeWallet(mnemonic);
          sparkWallet[hash] = wallet;
          return wallet;
        } catch (err) {
          delete initializingWallets[hash]; // cleanup after done
          delete sparkWallet[hash];
          throw err;
        }
      })();

      await initializingWallets[hash];
      delete initializingWallets[hash];
      setForceReactNative(true, 'native wallet initialized successfully');

      return { isConnected: true };
    } catch (err) {
      console.log(
        `Initialize spark wallet error (attempt ${attemptNumber + 1}/${
          maxRetries + 1
        }):`,
        err,
      );

      const hash = getMnemonicHash(mnemonic);
      delete initializingWallets[hash];
      delete sparkWallet[hash];

      // If retry is disabled or max retries reached, return error
      if (!enableRetry || attemptNumber >= maxRetries) {
        return { isConnected: false, error: err.message };
      }

      // Log retry attempt
      console.log(
        `Wallet failed to connect. Retrying in ${
          retryDelay / 1000
        } seconds... (${attemptNumber + 1}/${maxRetries} retries)`,
      );

      // Wait before retry
      await new Promise(res => setTimeout(res, retryDelay));

      // Recursive retry
      return attemptInitialization(attemptNumber + 1);
    }
  };

  return attemptInitialization(0);
};

const initializeWallet = async mnemonic => {
  const { wallet } = await SparkWallet.initialize({
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

export const initializeFlashnet = async mnemonic => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.initializeFlashnet,
        {
          mnemonic,
        },
      );

      return response.didWork;
    } else {
      const wallet = await getWallet(mnemonic);
      const flashnetAPI = new FlashnetClient(wallet, {
        autoAuthenticate: true,
      });
      await flashnetAPI.initialize();

      flashnetClients[sha256Hash(mnemonic)] = flashnetAPI;
      return true;
    }
  } catch (err) {
    console.log('Error initializing flashnet', err);
    return false;
  }
};

export const setPrivacyEnabled = async mnemonic => {
  try {
    const didSetPrivacySetting = await getLocalStorageItem(
      'didSetPrivacySetting',
    ).then(JSON.parse);

    if (didSetPrivacySetting) return;

    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.setPrivacyEnabled,
        {
          mnemonic,
        },
      );
      const validatedResponse = validateWebViewResponse(
        response,
        'unable to generate spark identity pubkey',
      );

      if (validatedResponse.didWork) {
        setLocalStorageItem('didSetPrivacySetting', JSON.stringify(true));
      }

      return;
    } else {
      const wallet = await getWallet(mnemonic);
      const walletSetings = await wallet.getWalletSettings();
      if (!walletSetings?.privateEnabled) {
        wallet.setPrivacyEnabled(true);
      } else {
        setLocalStorageItem('didSetPrivacySetting', JSON.stringify(true));
      }
      return true;
    }
  } catch (err) {
    console.log('Get spark balance error', err);
  }
};

export const getSparkIdentityPubKey = async (mnemonic, sendWebViewRequest) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const derivedIdentityPubKey = await deriveSparkIdentityKey(mnemonic, 1);

      if (derivedIdentityPubKey.publicKeyHex) {
        return derivedIdentityPubKey.publicKeyHex;
      }
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getIdentityKey,
        {
          mnemonic,
        },
      );

      return validateWebViewResponse(
        response,
        'unable to generate spark identity pubkey',
      );
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
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getBalance,
        {
          mnemonic,
        },
      );

      validateWebViewResponse(response, 'unable to get spark balance');

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
        currentTokensObj[tokensIdentifier] = {
          ...tokensData,
          balance: tokensData.availableToSendBalance,
        };
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
        OPERATION_TYPES.getL1Address,
        { mnemonic },
      );

      return validateWebViewResponse(
        response,
        'Not abler to generate bitcoin l1 daddress',
      );
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
        OPERATION_TYPES.queryStaticL1Address,
        { mnemonic },
      );
      return validateWebViewResponse(
        response,
        'Not able to query all bitcoin l1 daddress',
      );
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
        OPERATION_TYPES.getL1AddressQuote,
        { mnemonic, txid },
      );
      return validateWebViewResponse(
        response,
        'Not able to get bitcoin l1 quote',
      );
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
        OPERATION_TYPES.claimStaticDepositAddress,
        { mnemonic, creditAmountSats, sspSignature, transactionId },
      );

      return validateWebViewResponse(
        response,
        'Not able to clain bitcoin l1 deposit',
      );
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
      const derivedIdentityPubKey = await deriveSparkIdentityKey(mnemonic, 1);
      const derivedSparkAddress = deriveSparkAddress(
        derivedIdentityPubKey.publicKey,
      );
      if (derivedSparkAddress.address) {
        return { didWork: true, response: derivedSparkAddress.address };
      }

      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getSparkAddress,
        {
          mnemonic,
        },
      );
      return validateWebViewResponse(response, 'Not able to get spark address');
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
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.sendSparkPayment,
        {
          mnemonic,
          receiverSparkAddress,
          amountSats,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to send spark payment',
      );
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
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.sendTokenPayment,
        {
          mnemonic,
          tokenIdentifier,
          tokenAmount,
          receiverSparkAddress,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to send spark token payment',
      );
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
        OPERATION_TYPES.getLightningFee,
        {
          mnemonic,
          amountSat,
          invoice,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to get spark lightning fee estimate',
      );
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
        OPERATION_TYPES.getBitcoinPaymentRequest,
        {
          mnemonic,
          paymentId,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to get spark bitcoin payment request',
      );
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
        OPERATION_TYPES.getBitcoinPaymentFee,
        {
          mnemonic,
          amountSats,
          withdrawalAddress,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to get spark bitcoin payment fee',
      );
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
        OPERATION_TYPES.getSparkPaymentFee,
        {
          mnemonic,
          amountSats,
        },
      );
      validateWebViewResponse(
        response,
        'Not able to get spark bitcoin payment fee',
      );
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
  includeSparkAddress = true,
  expirySeconds = DEFAULT_PAYMENT_EXPIRY_SEC, // 12 hour invoice expiry
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.receiveLightningPayment,
        {
          mnemonic,
          amountSats,
          memo,
          expirySeconds,
          includeSparkAddress,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to get spark bitcoin lightning request',
      );
    } else {
      const wallet = await getWallet(mnemonic);
      const response = await wallet.createLightningInvoice({
        amountSats,
        memo,
        expirySeconds,
        includeSparkAddress,
      });
      return { didWork: true, response };
    }
  } catch (err) {
    console.log('Receive lightning payment error', err);
    return { didWork: false, error: err.message };
  }
};

export const claimSparkHodlLightningPayment = async ({
  preimage,
  mnemonic,
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.claimSparkHodlLightningPayment,
        {
          preimage,
          mnemonic,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to get hold lightning invoice request',
      );
    } else {
      const wallet = await getWallet(mnemonic);
      const response = await wallet.claimHTLC(preimage);
      return { didWork: true, response };
    }
  } catch (err) {
    console.log('Receive HODL lightning payment error', err);
    return { didWork: false, error: err.message };
  }
};

export const querySparkHodlLightningPayments = async ({
  paymentHashes = [],
  mnemonic,
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.querySparkHodlLightningPayments,
        {
          paymentHashes,
          mnemonic,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to get hold lightning invoice request',
      );
    } else {
      const wallet = await getWallet(mnemonic);
      const response = await await wallet.queryHTLC({
        paymentHashes,
        limit: 50,
        offset: 0,
      });
      const paidPreimages = response.preimageRequests.map(request => ({
        status: request.status,
        createdTime: request.createdTime,
        paymentHash: Buffer.from(request.paymentHash).toString('hex'),
        transferId: request.transfer.id,
        satValue: request.transfer.totalValue,
      }));
      return { didWork: true, paidPreimages };
    }
  } catch (err) {
    console.log('Receive HODL lightning payment error', err);
    return { didWork: false, error: err.message };
  }
};

export const receiveSparkHodlLightningPayment = async ({
  amountSats,
  paymentHash,
  memo,
  expirySeconds,
  mnemonic,
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.receiveSparkHodlLightningPayment,
        {
          amountSats,
          paymentHash,
          memo,
          expirySeconds,
          mnemonic,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to get hold lightning invoice request',
      );
    } else {
      // createLightningHodlInvoice is native-SDK only; always use native runtime
      const wallet = await getWallet(mnemonic);
      const response = await wallet.createLightningHodlInvoice({
        amountSats,
        paymentHash,
        memo,
        expirySeconds,
        includeSparkAddress: false,
      });
      return { didWork: true, response };
    }
  } catch (err) {
    console.log('Receive HODL lightning payment error', err);
    return { didWork: false, error: err.message };
  }
};

export const getSparkLightningSendRequest = async (id, mnemonic) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getLightningSendRequest,
        {
          mnemonic,
          id,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to get spark bitcoin lightning send request',
      );
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
        OPERATION_TYPES.getLightningPaymentStatus,
        {
          mnemonic,
          lightningInvoiceId,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to get spark bitcoin lightning payment status',
      );
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
        OPERATION_TYPES.sendLightningPayment,
        {
          mnemonic,
          invoice,
          maxFeeSats,
          amountSat: amountSats,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to send spark bitcoin lightning payment',
      );
    } else {
      const wallet = await getWallet(mnemonic);
      const paymentResponse = await wallet.payLightningInvoice({
        invoice: invoice.toLowerCase(),
        maxFeeSats: maxFeeSats,
        amountSatsToSend: amountSats,
        preferSpark: true,
      });
      return { didWork: true, paymentResponse };
    }
  } catch (err) {
    console.log('Send lightning payment error', err);
    return { didWork: false, error: err.message };
  }
};

export const getUtxosForDepositAddress = async ({
  depositAddress,
  mnemonic,
  limit = 100,
  offset = 0,
  excludeClaimed = true,
}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getUtxosForDepositAddress,
        {
          depositAddress,
          mnemonic,
          limit,
          offset,
          excludeClaimed,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to send spark bitcoin payment',
      );
    } else {
      const wallet = await getWallet(mnemonic);
      const utxos = await wallet.getUtxosForDepositAddress(
        depositAddress,
        limit,
        offset,
        excludeClaimed,
      );
      return { didWork: true, utxos };
    }
  } catch (err) {
    console.log('Send Bitcoin payment error', err);
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
        OPERATION_TYPES.sendBitcoinPayment,
        {
          mnemonic,
          onchainAddress,
          exitSpeed,
          feeQuote,
          amountSats,
          deductFeeFromWithdrawalAmount,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to send spark bitcoin payment',
      );
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
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getTransactions,
        {
          mnemonic,
          transferCount,
          offsetIndex,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to send spark transactions',
      );
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
        OPERATION_TYPES.getTokenTransactions,
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
      return validateWebViewResponse(
        response,
        'Not able to send spark token transactions',
      );
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

export const createSatsInvoice = async mnemonic => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.createSatsInvoice,
        {
          mnemonic,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to send spark transactions',
      );
    } else {
      const wallet = await getWallet(mnemonic);
      const invoice = await wallet.createSatsInvoice({});
      console.log('Spark Invoice:', invoice); // Returns SparkAddressFormat directly
      return { didWork: true, invoice };
    }
  } catch (err) {
    console.log('get spark transactions error', err);
    return { didWork: false, error: err.message };
  }
};

export const createTokensInvoice = async (
  mnemonic,
  tokenIdentifier = USDB_TOKEN_ID,
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.createTokensInvoice,
        {
          mnemonic,
          tokenIdentifier,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to send spark transactions',
      );
    } else {
      const wallet = await getWallet(mnemonic);
      const invoice = await wallet.createTokensInvoice({
        tokenIdentifier,
      });

      console.log('Token Invoice:', invoice);
      return { didWork: true, invoice };
    }
  } catch (err) {
    console.log('get spark transactions error', err);
    return { didWork: false, error: err.message };
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
    status === ClaimStaticDepositStatus.TRANSFER_COMPLETED ||
    status === ClaimStaticDepositStatus.SPEND_TX_BROADCAST
    ? 'completed'
    : status === 'TRANSFER_STATUS_RETURNED' ||
      status === 'TRANSFER_STATUS_EXPIRED' ||
      status === 'TRANSFER_STATUS_SENDER_INITIATED' ||
      status === LightningSendRequestStatus.USER_SWAP_RETURNED ||
      status === LightningSendRequestStatus.LIGHTNING_PAYMENT_FAILED ||
      status === LightningSendRequestStatus.TRANSFER_FAILED ||
      status === LightningSendRequestStatus.USER_TRANSFER_VALIDATION_FAILED ||
      status === LightningSendRequestStatus.PREIMAGE_PROVIDING_FAILED ||
      status === LightningSendRequestStatus.USER_SWAP_RETURN_FAILED ||
      status === SparkCoopExitRequestStatus.FAILED ||
      status === SparkCoopExitRequestStatus.EXPIRED ||
      status === LightningReceiveRequestStatus.TRANSFER_FAILED ||
      status ===
        LightningReceiveRequestStatus.PAYMENT_PREIMAGE_RECOVERING_FAILED ||
      status ===
        LightningReceiveRequestStatus.REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED ||
      status === LightningReceiveRequestStatus.REFUND_SIGNING_FAILED ||
      status === LightningReceiveRequestStatus.TRANSFER_CREATION_FAILED ||
      status === SparkLeavesSwapRequestStatus.FAILED ||
      status === SparkLeavesSwapRequestStatus.EXPIRED ||
      status === SparkUserRequestStatus.FAILED ||
      status === SparkUserRequestStatus.CANCELED ||
      status === ClaimStaticDepositStatus.TRANSFER_CREATION_FAILED ||
      status === ClaimStaticDepositStatus.REFUND_SIGNING_FAILED ||
      status === ClaimStaticDepositStatus.UTXO_SWAPPING_FAILED ||
      status ===
        ClaimStaticDepositStatus.REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED
    ? 'failed'
    : 'pending';
};

export const getSingleTxDetails = async (mnemonic, id) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getSingleTxDetails,
        {
          mnemonic,
          id,
        },
      );
      return validateWebViewResponse(response, 'No transaction found');
    } else {
      const wallet = await getWallet(mnemonic);
      return await wallet.getTransfer(id);
    }
  } catch (err) {
    console.log('get single spark transaction error', err);
    return undefined;
  }
};

/**
 * Validates WebView response and throws if error present
 */
export const validateWebViewResponse = (response, errorMessage) => {
  if (!response) {
    throw new Error(errorMessage || 'No response from WebView');
  }

  if (response.error) {
    throw new Error(response.error);
  }

  if (response.hasOwnProperty('didWork') && !response.didWork) {
    throw new Error(response.error || errorMessage || 'Operation failed');
  }

  return response;
};
