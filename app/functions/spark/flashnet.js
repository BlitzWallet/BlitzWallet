// ============================================
// IMPROVED FLASHNET SWAP & LIGHTNING PAYMENT FUNCTIONS
// Based on Official Flashnet SDK Documentation v0.4.2+
// ============================================

import {
  FlashnetError,
  getErrorMetadata,
  isFlashnetError,
  isFlashnetErrorCode,
} from '@flashnet/sdk';
import {
  getFlashnetClient,
  getSingleTxDetails,
  getSparkLightningPaymentStatus,
  initializeFlashnet,
  selectSparkRuntime,
  validateWebViewResponse,
} from '.';
import i18next from 'i18next';
import {
  OPERATION_TYPES,
  sendWebViewRequestGlobal,
} from '../../../context-store/webViewContext';
import {
  FLASHNET_ERROR_CODE_REGEX,
  FLASHNET_REFUND_REGEX,
  USDB_TOKEN_ID,
} from '../../constants';
import {
  isFlashnetTransfer,
  setFlashnetTransfer,
} from './handleFlashnetTransferIds';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';
import {
  bulkUpdateSparkTransactions,
  getSingleSparkLightningRequest,
} from './transactions';
import { decode } from 'bolt11';

// ============================================
// CONSTANTS
// ============================================

// Standard Bitcoin pubkey for pools (constant across Flashnet)
export const BTC_ASSET_ADDRESS =
  '020202020202020202020202020202020202020202020202020202020202020202';
export const USD_ASSET_ADDRESS =
  '3206c93b24a4d18ea19d0a9a213204af2c7e74a6d16c7535cc5d33eca4ad1eca';

export const FLASHNET_POOL_IDENTITY_KEY =
  '02894808873b896e21d29856a6d7bb346fb13c019739adb9bf0b6a8b7e28da53da';

// Default slippage tolerance
export const DEFAULT_SLIPPAGE_BPS = 300; // %
export const SEND_AMOUNT_INCREASE_BUFFER = 1.03; // 3%
export const DEFAULT_MAX_SLIPPAGE_BPS = 500; // 5% for lightning payments

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format error for logging
 */
const formatError = (error, operation) => {
  if (isFlashnetError(error)) {
    return {
      operation,
      errorCode: error.errorCode,
      category: error.category,
      message: error.userMessage,
      userMessage: i18next.t(`flashnetUserMessages.${error.errorCode}`, {
        defaultValue: error.userMessage,
      }),
      actionHint: error.actionHint,
      requestId: error.requestId,
      isRetryable: error.isRetryable,
      recovery: error.recovery,
      transferIds: error.transferIds,
      clawbackAttempted: error.wasClawbackAttempted?.() || false,
      fundsRecovered: error.wereAllTransfersRecovered?.() || false,
    };
  }

  let parsedError;
  if (typeof error === 'object') {
    parsedError = error.message;
  } else {
    parsedError = error;
  }

  const match = parsedError.match(FLASHNET_ERROR_CODE_REGEX);
  const errorCode = match?.[0] ?? null;

  if (errorCode) {
    const metadata = getErrorMetadata(errorCode);

    return {
      operation,
      errorCode: errorCode,
      category: metadata.category,
      message: metadata.userMessage,
      userMessage: i18next.t(`flashnetUserMessages.${errorCode}`, {
        defaultValue: metadata.userMessage,
      }),
      actionHint: metadata.actionHint,
      isRetryable: metadata.isRetryable,
      recovery: metadata.recovery,
      transferIds: metadata.transferIds,
      clawbackAttempted: metadata.wasClawbackAttempted?.() || false,
      fundsRecovered: metadata.wereAllTransfersRecovered?.() || false,
    };
  }

  return {
    operation,
    message: error?.message || String(error),
  };
};

/**
 * Calculate minimum output with slippage tolerance
 */
export const calculateMinOutput = (expectedOutput, slippageBps) => {
  const amount = BigInt(expectedOutput);
  const slippageFactor = BigInt(10000 - slippageBps);
  const minAmount = (amount * slippageFactor) / 10000n;
  return minAmount.toString();
};

// ============================================
// POOL DISCOVERY & QUERYING
// ============================================

/**
 * Find the best pool for a given token pair
 * @param {string} mnemonic - Wallet mnemonic
 * @param {string} tokenAAddress - First asset address
 * @param {string} tokenBAddress - Second asset address
 * @param {object} options - Optional filters
 * @returns {Promise<object>} Pool details
 */
export const findBestPool = async (
  mnemonic,
  tokenAAddress,
  tokenBAddress,
  options = {},
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);

    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.findBestPool,
        {
          mnemonic,
          tokenAAddress,
          tokenBAddress,
          options,
        },
      );
      return validateWebViewResponse(response, 'Not able to find best pool');
    } else {
      const client = getFlashnetClient(mnemonic);
      console.log(client, tokenAAddress, tokenBAddress);

      const pools = await client.listPools({
        assetAAddress: tokenAAddress,
        assetBAddress: tokenBAddress,
        sort: 'TVL_DESC', // Prefer highest TVL (best liquidity)
        minTvl: options.minTvl || 1000,
        limit: options.limit || 10,
      });
      console.log(pools, 'test');

      if (!pools.pools || pools.pools.length === 0) {
        throw new Error(
          i18next.t('screens.inAccount.swapsPage.noPoolsFoundError', {
            tokenAAddress,
            tokenBAddress,
          }),
        );
      }

      // Return the best pool (highest TVL)
      return {
        didWork: true,
        pool: pools.pools[0],
        totalAvailable: pools.totalCount,
      };
    }
  } catch (error) {
    const formatted = formatError(error, 'findBestPool');
    console.warn('Find best pool error:', formatError(error, 'findBestPool'));
    if (formatted.message === 'Flashnet client not initialized') {
      initializeFlashnet(mnemonic);
    }
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'findBestPool'),
    };
  }
};

/**
 * Get detailed information about a specific pool
 * @param {string} mnemonic - Wallet mnemonic
 * @param {string} poolId - Pool's lpPublicKey
 * @returns {Promise<object>} Pool details
 */
export const getPoolDetails = async (mnemonic, poolId) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);

    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getPoolDetails,
        {
          mnemonic,
          poolId,
        },
      );
      return validateWebViewResponse(response, 'Not able to get pool detials');
    } else {
      const client = getFlashnetClient(mnemonic);
      const pool = await client.getPool(poolId);

      return {
        didWork: true,
        pool,
        marketData: {
          tvl: pool.tvlAssetB,
          volume24h: pool.volume24hAssetB,
          priceChange24h: pool.priceChangePercent24h,
          currentPrice: pool.currentPriceAInB,
          reserves: {
            assetA: pool.assetAReserve,
            assetB: pool.assetBReserve,
          },
        },
      };
    }
  } catch (error) {
    console.warn(
      'Get pool details error:',
      formatError(error, 'getPoolDetails'),
    );
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'getPoolDetails'),
    };
  }
};

/**
 * List all available pools with optional filters
 * @param {string} mnemonic - Wallet mnemonic
 * @param {object} filters - Optional filtering/sorting parameters
 * @returns {Promise<object>} List of pools
 */
export const listAllPools = async (mnemonic, filters = {}) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);

    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.listAllPools,
        {
          mnemonic,
          filters,
        },
      );
      return validateWebViewResponse(response, 'Not able to list all pools');
    } else {
      const client = getFlashnetClient(mnemonic);

      const response = await client.listPools({
        minTvl: filters.minTvl || 0,
        minVolume24h: filters.minVolume24h || 0,
        sort: filters.sort || 'TVL_DESC',
        limit: filters.limit || 50,
        offset: filters.offset || 0,
        hostNames: filters.hostNames,
        curveTypes: filters.curveTypes,
      });

      return {
        didWork: true,
        pools: response.pools,
        totalCount: response.totalCount,
      };
    }
  } catch (error) {
    console.warn('List pools error:', formatError(error, 'listAllPools'));
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'listAllPools'),
    };
  }
};

/**
 * Gets the minimum swap amounts for a given asset
 * @param {string} mnemonic - Wallet mnemonic
 * @param {object} filters - Asset hex
 * @returns {Promise<object>} List of pools
 */
export const minFlashnetSwapAmounts = async (mnemonic, assetHex) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);

    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.minFlashnetSwapAmounts,
        { mnemonic, assetHex },
      );
      return validateWebViewResponse(
        response,
        'Not able to get min flashnet swap limits',
      );
    } else {
      const client = getFlashnetClient(mnemonic);
      const minMap = await client.getMinAmountsMap();

      const assetData = minMap.get(assetHex.toLowerCase());

      return {
        didWork: true,
        assetData: assetData,
      };
    }
  } catch (error) {
    console.warn(
      'List pools error:',
      formatError(error, 'minFlashnetSwapAmounts'),
    );
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'minFlashnetSwapAmounts'),
    };
  }
};

// ============================================
// SWAP SIMULATION & EXECUTION
// ============================================

/**
 * Simulate a swap to get expected output and price impact
 * @param {string} mnemonic - Wallet mnemonic
 * @param {object} params - Swap parameters
 * @returns {Promise<object>} Simulation results
 */
export const simulateSwap = async (
  mnemonic,
  {
    poolId,
    assetInAddress,
    assetOutAddress,
    amountIn,
    integratorFeeRateBps = 100,
  },
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.simulateSwap,
        {
          mnemonic,
          poolId,
          assetInAddress,
          assetOutAddress,
          amountIn,
          integratorFeeRateBps,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to simulate flashnet swap',
      );
    } else {
      const client = getFlashnetClient(mnemonic);

      const simulation = await client.simulateSwap({
        poolId,
        assetInAddress,
        assetOutAddress,
        amountIn: amountIn.toString(),
        integratorBps: integratorFeeRateBps,
      });

      return {
        didWork: true,
        simulation: {
          expectedOutput: simulation.amountOut,
          executionPrice: simulation.executionPrice,
          priceImpact: simulation.priceImpactPct,
          poolId: simulation.poolId,
          feePaidAssetIn: simulation.feePaidAssetIn,
        },
      };
    }
  } catch (error) {
    console.warn('Simulate swap error:', formatError(error, 'simulateSwap'));
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'simulateSwap'),
    };
  }
};

/**
 * Execute a token swap with slippage protection
 * @param {string} mnemonic - Wallet mnemonic
 * @param {object} params - Swap parameters
 * @returns {Promise<object>} Swap result
 */
export const executeSwap = async (
  mnemonic,
  {
    poolId,
    assetInAddress,
    assetOutAddress,
    amountIn,
    minAmountOut, // Optional - will be calculated if not provided
    maxSlippageBps = DEFAULT_SLIPPAGE_BPS,
    integratorFeeRateBps = 100,
  },
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.executeSwap,
        {
          mnemonic,
          poolId,
          assetInAddress,
          assetOutAddress,
          amountIn,
          minAmountOut,
          maxSlippageBps,
          integratorFeeRateBps,
        },
      );
      if (!response.didWork) {
        if (assetInAddress === BTC_ASSET_ADDRESS) {
          const id = getRefundTxidFromErrormessage(response.error);
          if (id) {
            setFlashnetTransfer(id);
          }
        }
        const error = formatAndReturnWebviewError(response);
        return error;
      }
      return validateWebViewResponse(response, 'Not able to executeSwap');
    } else {
      const client = getFlashnetClient(mnemonic);

      // Simulate first if minAmountOut not provided
      let calculatedMinOut = minAmountOut;
      if (!calculatedMinOut) {
        const simulation = await client.simulateSwap({
          poolId,
          assetInAddress,
          assetOutAddress,
          amountIn: amountIn.toString(),
          integratorBps: integratorFeeRateBps,
        });
        calculatedMinOut = calculateMinOutput(
          simulation.amountOut,
          maxSlippageBps,
        );
      }

      // Execute the swap
      const swap = await client.executeSwap({
        poolId,
        assetInAddress,
        assetOutAddress,
        amountIn: amountIn.toString(),
        minAmountOut: calculatedMinOut.toString(),
        maxSlippageBps,
        integratorFeeRateBps,
        integratorPublicKey: process.env.BLITZ_SPARK_PUBLICKEY,
      });

      return {
        didWork: true,
        swap: {
          amountOut: swap.amountOut,
          executionPrice: swap.executionPrice,
          feeAmount: swap.feeAmount,
          flashnetRequestId: swap.flashnetRequestId,
          outboundTransferId: swap.outboundTransferId,
          poolId: swap.poolId,
        },
      };
    }
  } catch (error) {
    const errorDetails = formatError(error, 'executeSwap');
    console.warn('Execute swap error:', errorDetails);

    const id = getRefundTxidFromErrormessage(error.message);
    if (id) {
      setFlashnetTransfer(id);
    }

    // Check for auto-clawback results
    if (isFlashnetError(error) && error.wasClawbackAttempted()) {
      errorDetails.clawbackSummary = {
        attempted: true,
        allRecovered: error.wereAllTransfersRecovered(),
        partialRecovered: error.werePartialTransfersRecovered(),
        recoveredCount: error.getRecoveredTransferCount?.() || 0,
        recoveredIds: error.getRecoveredTransferIds?.() || [],
        unrecoveredIds: error.getUnrecoveredTransferIds?.() || [],
      };
    }

    return {
      didWork: false,
      error: error.message,
      details: errorDetails,
    };
  }
};

// ============================================
// BITCOIN <-> TOKEN SWAPS (Convenience Functions)
// ============================================

/**
 * Swap Bitcoin to Token
 * @param {string} mnemonic - Wallet mnemonic
 * @param {object} params - Swap parameters
 * @returns {Promise<object>} Swap result
 */
export const swapBitcoinToToken = async (
  mnemonic,
  {
    tokenAddress,
    amountSats,
    poolId = null,
    maxSlippageBps = DEFAULT_SLIPPAGE_BPS,
  },
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.swapBitcoinToToken,
        {
          mnemonic,
          tokenAddress,
          amountSats,
          poolId,
          maxSlippageBps,
        },
      );

      if (!response.didWork) {
        const id = getRefundTxidFromErrormessage(response.error);
        if (id) {
          setFlashnetTransfer(id);
        }
        const error = formatAndReturnWebviewError(response);
        return error;
      }
      return validateWebViewResponse(
        response,
        'Not able to swapBitcoinToToken',
      );
    } else {
      // Find best pool if not provided
      let targetPoolId = poolId;
      if (!targetPoolId) {
        const poolResult = await findBestPool(
          mnemonic,
          BTC_ASSET_ADDRESS,
          tokenAddress,
        );
        if (!poolResult.didWork) {
          throw new Error('No suitable pool found for BTC/' + tokenAddress);
        }
        targetPoolId = poolResult.pool.lpPublicKey;
      }

      return await executeSwap(mnemonic, {
        poolId: targetPoolId,
        assetInAddress: BTC_ASSET_ADDRESS,
        assetOutAddress: tokenAddress,
        amountIn: amountSats,
        maxSlippageBps,
      });
    }
  } catch (error) {
    console.warn(
      'Swap BTC to token error:',
      formatError(error, 'swapBitcoinToToken'),
    );
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'swapBitcoinToToken'),
    };
  }
};

/**
 * Swap Token to Bitcoin
 * @param {string} mnemonic - Wallet mnemonic
 * @param {object} params - Swap parameters
 * @returns {Promise<object>} Swap result
 */
export const swapTokenToBitcoin = async (
  mnemonic,
  {
    tokenAddress,
    tokenAmount,
    poolId = null,
    maxSlippageBps = DEFAULT_SLIPPAGE_BPS,
  },
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.swapTokenToBitcoin,
        {
          mnemonic,
          tokenAddress,
          tokenAmount,
          poolId,
          maxSlippageBps,
        },
      );

      if (!response.didWork) {
        const error = formatAndReturnWebviewError(response);
        return error;
      }
      return validateWebViewResponse(
        response,
        'Not able to swapTokenToBitcoin',
      );
    } else {
      // Find best pool if not provided
      let targetPoolId = poolId;
      if (!targetPoolId) {
        const poolResult = await findBestPool(
          mnemonic,
          tokenAddress,
          BTC_ASSET_ADDRESS,
        );
        if (!poolResult.didWork) {
          throw new Error(
            'No suitable pool found for ' + tokenAddress + '/BTC',
          );
        }
        targetPoolId = poolResult.pool.lpPublicKey;
      }

      return await executeSwap(mnemonic, {
        poolId: targetPoolId,
        assetInAddress: tokenAddress,
        assetOutAddress: BTC_ASSET_ADDRESS,
        amountIn: tokenAmount,
        maxSlippageBps,
      });
    }
  } catch (error) {
    console.warn(
      'Swap token to BTC error:',
      formatError(error, 'swapTokenToBitcoin'),
    );
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'swapTokenToBitcoin'),
    };
  }
};

// ============================================
// LIGHTNING PAYMENTS WITH TOKEN
// ============================================

/**
 * Get quote for paying a Lightning invoice with tokens
 * @param {string} mnemonic - Wallet mnemonic
 * @param {string} invoice - BOLT11 invoice
 * @param {string} tokenAddress - Token to spend
 * @returns {Promise<object>} Payment quote
 */
export const getLightningPaymentQuote = async (
  mnemonic,
  invoice,
  tokenAddress,
  integratorFeeRateBps = 100,
  maxSlippageBps = DEFAULT_MAX_SLIPPAGE_BPS,
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getLightningPaymentQuote,
        {
          mnemonic,
          invoice,
          tokenAddress,
          integratorFeeRateBps,
          maxSlippageBps,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to getLightningPaymentQuote',
      );
    } else {
      const client = getFlashnetClient(mnemonic);

      const quote = await client.getPayLightningWithTokenQuote(
        invoice,
        tokenAddress,
        {
          integratorFeeRateBps,
          maxSlippageBps,
        },
      );

      return {
        didWork: true,
        quote: {
          invoiceAmountSats: quote.invoiceAmountSats,
          estimatedLightningFee: quote.estimatedLightningFee,
          btcAmountRequired: quote.btcAmountRequired,
          tokenAmountRequired: quote.tokenAmountRequired,
          estimatedAmmFee: quote.estimatedAmmFee,
          executionPrice: quote.executionPrice,
          priceImpact: quote.priceImpactPct,
          poolId: quote.poolId,
          fee: quote.btcAmountRequired - quote.invoiceAmountSats,
        },
      };
    }
  } catch (error) {
    console.warn(
      'Get Lightning quote error:',
      formatError(error, 'getLightningPaymentQuote'),
    );
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'getLightningPaymentQuote'),
    };
  }
};

/**
 * Pay a Lightning invoice using tokens
 * @param {string} mnemonic - Wallet mnemonic
 * @param {object} params - Payment parameters
 * @returns {Promise<object>} Payment result
 */
export const payLightningWithToken = async (
  mnemonic,
  {
    invoice,
    tokenAddress,
    maxSlippageBps = DEFAULT_MAX_SLIPPAGE_BPS,
    maxLightningFeeSats = null,
    rollbackOnFailure = true,
    useExistingBtcBalance = false,
    integratorFeeRateBps = 100,
  },
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.payLightningWithToken,
        {
          mnemonic,
          invoice,
          tokenAddress,
          maxSlippageBps,
          maxLightningFeeSats,
          rollbackOnFailure,
          useExistingBtcBalance,
          integratorFeeRateBps,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to payLightningWithToken',
      );
    } else {
      const client = getFlashnetClient(mnemonic);

      const result = await client.payLightningWithToken({
        invoice,
        tokenAddress,
        maxSlippageBps,
        maxLightningFeeSats: maxLightningFeeSats || undefined,
        rollbackOnFailure,
        useExistingBtcBalance,
        integratorFeeRateBps,
        integratorPublicKey: process.env.BLITZ_SPARK_PUBLICKEY,
      });

      console.log('token lightning payment response:', result);

      if (result.success) {
        return {
          didWork: true,
          result: {
            success: true,
            lightningPaymentId: result.lightningPaymentId,
            tokenAmountSpent: result.tokenAmountSpent,
            btcAmountReceived: result.btcAmountReceived,
            swapTransferId: result.swapTransferId,
            ammFeePaid: result.ammFeePaid,
            lightningFeePaid: result.lightningFeePaid,
            poolId: result.poolId,
          },
        };
      } else {
        return {
          didWork: false,
          error: result.error,
          result: {
            success: false,
            error: result.error,
            poolId: result.poolId,
            tokenAmountSpent: result.tokenAmountSpent,
            btcAmountReceived: result.btcAmountReceived,
          },
        };
      }
    }
  } catch (error) {
    console.warn(
      'Pay Lightning with token error:',
      formatError(error, 'payLightningWithToken'),
    );
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'payLightningWithToken'),
    };
  }
};

// ============================================
// SWAP HISTORY
// ============================================

/**
 * Get user's swap history
 * @param {string} mnemonic - Wallet mnemonic
 * @param {number} limit - Number of swaps to retrieve
 * @returns {Promise<object>} Swap history
 */
export const getUserSwapHistory = async (mnemonic, limit = 50, offset) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.getUserSwapHistory,
        {
          mnemonic,
          limit,
          offset,
        },
      );
      return validateWebViewResponse(
        response,
        'Not able to getUserSwapHistory',
      );
    } else {
      const client = getFlashnetClient(mnemonic);

      let result;
      if (offset) {
        result = await client.getUserSwaps(undefined, { limit, offset });
      } else {
        result = await client.getUserSwaps(undefined, { limit });
      }

      console.log('User swap history response:', result);

      return {
        didWork: true,
        swaps: result.swaps || [],
        totalCount: result.totalCount || 0,
      };
    }
  } catch (error) {
    console.warn(
      'Get swap history error:',
      formatError(error, 'getUserSwapHistory'),
    );
    return {
      didWork: false,
      error: error.message,
      swaps: [],
      details: formatError(error, 'getUserSwapHistory'),
    };
  }
};

// ============================================
// Track current LN -> USD swaps for the session
// ============================================

let activeSwapTransferIds = new Set();

/**
 * Checks to see if we have any pending ln -> btc swaps
 * @returns {Boolean} True if we have pending swaps
 */
export const isSwapActive = () => {
  return activeSwapTransferIds.size > 0;
};

/**
 * Gets pending swaps ids
 * @returns {Set} Set of pending swap transfers
 */
export const getActiveSwapTransferIds = () => {
  return new Set(activeSwapTransferIds);
};

/**
 * Adds a transfer id to the pending swaps set
 * @param {string} transferId - Outbound transfer id of an execution resposne
 * @returns {undefined}
 */
export const addActiveSwap = transferId => {
  activeSwapTransferIds.add(transferId);
  console.log(
    `[Swap Tracker] Added swap ${transferId}, total active: ${activeSwapTransferIds.size}`,
  );
};

/**
 * Removes a transfer id to the pending swaps set
 * @param {string} transferId - Outbound transfer id of an execution resposne
 * @returns {undefined}
 */
export const removeActiveSwap = transferId => {
  activeSwapTransferIds.delete(transferId);
  console.log(
    `[Swap Tracker] Removed swap ${transferId}, total active: ${activeSwapTransferIds.size}`,
  );
};

// ============================================
// AUTO SWAP COMPLETION TRACKING
// ============================================

// Storage key constant
const PENDING_SWAP_CONFIRMATIONS_KEY = 'pendingSwapConfirmations';

/**
 * Saves an active swap to be checked later if not completed
 * @param {string} sparkRequestID - Lightning spark request ID
 * @param {string} outboundTransferId - Outbound transfer id of an execution resposne
 * @returns {Promise<undefined>}
 */
export const savePendingSwapConfirmation = async (
  sparkRequestID,
  outboundTransferId,
) => {
  try {
    const existing = await getLocalStorageItem(PENDING_SWAP_CONFIRMATIONS_KEY);
    const pending = existing ? JSON.parse(existing) : {};

    pending[sparkRequestID] = {
      outboundTransferId,
      timestamp: Date.now(),
      lastChecked: null,
    };

    await setLocalStorageItem(
      PENDING_SWAP_CONFIRMATIONS_KEY,
      JSON.stringify(pending),
    );
    console.log('[Swap Retry] Saved pending confirmation:', sparkRequestID);
  } catch (err) {
    console.error('[Swap Retry] Failed to save pending confirmation:', err);
  }
};

/**
 * Removes an active swap to be checked later if not completed
 * @param {string} sparkRequestID - Lightning spark request ID
 * @returns {Promise<undefined>}
 */
export const removePendingSwapConfirmation = async sparkRequestID => {
  try {
    const existing = await getLocalStorageItem(PENDING_SWAP_CONFIRMATIONS_KEY);
    if (!existing) return;

    const pending = JSON.parse(existing);
    delete pending[sparkRequestID];

    await setLocalStorageItem(
      PENDING_SWAP_CONFIRMATIONS_KEY,
      JSON.stringify(pending),
    );
    console.log('[Swap Retry] Removed pending confirmation:', sparkRequestID);
  } catch (err) {
    console.error('[Swap Retry] Failed to remove pending confirmation:', err);
  }
};

/**
 * Gets all active swaps to be checked if not completed
 * @param {string} sparkRequestID - Lightning spark request ID
 * @returns {Promise<object>} - object of active swaps
 */
export const getPendingSwapConfirmations = async () => {
  try {
    const existing = await getLocalStorageItem(PENDING_SWAP_CONFIRMATIONS_KEY);
    return existing ? JSON.parse(existing) : {};
  } catch (err) {
    console.error('[Swap Retry] Failed to get pending confirmations:', err);
    return {};
  }
};

/**
 * Completes the auto swap process
 * @param {string} sparkRequestID - Lightning spark request ID
 * @param {string} outboundTransferId - Outbound swap transfer ID
 * @param {Object} lightningRequest - Lightning request response by spark
 * @param {Object} txDetails - Saved ln swap payment details
 * @param {Object} result - Execution result
 * @param {string} invoice - Lightning invoice
 * @returns {Promise<boolean>} - true or false based on sucess
 */
export const completeSwapConfirmation = async (
  sparkRequestID,
  outboundTransferId,
  lightningRequest,
  txDetails,
  result,
  invoice,
  mnemoinc,
  sparkInfoRef,
) => {
  try {
    console.log(
      '[Swap Confirmation] Starting confirmation for:',
      sparkRequestID,
    );

    const realFeeAmount = Math.round(
      dollarsToSats(
        result.swap.feeAmount / Math.pow(10, 6),
        result.swap.executionPrice,
      ),
    );

    const userSwaps = await getUserSwapHistory(mnemoinc, 5);

    const swap = userSwaps.swaps.find(
      savedSwap => savedSwap.outboundTransferId === outboundTransferId,
    );

    if (!swap) {
      console.error('[Swap Confirmation] Swap not found in history');
      return false;
    }

    const description = invoice
      ? decode(invoice).tags.find(tag => tag.tagName === 'description')?.data ||
        lightningRequest?.description ||
        ''
      : lightningRequest?.description || '';

    // Clear funding and ln payment from tx list
    setFlashnetTransfer(swap.inboundTransferId);
    setFlashnetTransfer(txDetails.id);

    const tx = {
      id: swap.outboundTransferId,
      paymentStatus: 'completed',
      paymentType: 'spark',
      accountId: sparkInfoRef.current.identityPubKey,
      details: {
        fee: realFeeAmount,
        totalFee: realFeeAmount,
        supportFee: 0,
        amount: parseFloat(result.swap.amountOut),
        description: description,
        address: sparkInfoRef.current.sparkAddress,
        time: Date.now() + 1000,
        createdAt: Date.now() + 1000,
        direction: 'INCOMING',
        isLRC20Payment: true,
        LRC20Token: USDB_TOKEN_ID,
        showSwapLabel: true,
        currentPriceAInB: swap.price,
        ln_funding_id: txDetails.id,
      },
    };

    await bulkUpdateSparkTransactions([tx], 'fullUpdate-tokens');
    removeActiveSwap(outboundTransferId);

    await removePendingSwapConfirmation(sparkRequestID);

    console.log('[Swap Confirmation] Completed successfully');
    return true;
  } catch (err) {
    console.error('[Swap Confirmation] Error:', err);
    return false;
  }
};

export const retryPendingSwapConfirmations = async (mnemoinc, sparkInfoRef) => {
  try {
    console.log('[Swap Retry] Checking for pending confirmations...');

    const pending = await getPendingSwapConfirmations();
    const sparkRequestIDs = Object.keys(pending);

    if (sparkRequestIDs.length === 0) {
      console.log('[Swap Retry] No pending confirmations found');
      return;
    }

    console.log(
      `[Swap Retry] Found ${sparkRequestIDs.length} pending confirmation(s)`,
    );

    for (const sparkRequestID of sparkRequestIDs) {
      const { outboundTransferId, timestamp, lastChecked } =
        pending[sparkRequestID];

      // Only remove if too old AND has been checked at least once
      const MAX_AGE = 24 * 60 * 60 * 1000;
      if (lastChecked && Date.now() - timestamp > MAX_AGE) {
        console.warn(
          `[Swap Retry] Confirmation too old (checked at least once), removing:`,
          sparkRequestID,
        );
        await removePendingSwapConfirmation(sparkRequestID);
        continue;
      }

      try {
        console.log(`[Swap Retry] Retrying confirmation for:`, sparkRequestID);

        // Update lastChecked timestamp
        const updatedPending = await getPendingSwapConfirmations();
        if (updatedPending[sparkRequestID]) {
          updatedPending[sparkRequestID].lastChecked = Date.now();
          await setLocalStorageItem(
            PENDING_SWAP_CONFIRMATIONS_KEY,
            JSON.stringify(updatedPending),
          );
        }

        let swap = null;
        let offset = 0;
        const batchSize = 10;
        const maxSwaps = 50;

        while (!swap && offset < maxSwaps) {
          const userSwaps = await getUserSwapHistory(
            mnemoinc,
            batchSize,
            offset,
          );

          if (!userSwaps?.swaps || userSwaps.swaps.length === 0) {
            break;
          }

          swap = userSwaps.swaps.find(
            s => s.outboundTransferId === outboundTransferId,
          );

          if (!swap) {
            offset += batchSize;
          }
        }

        if (!swap) {
          console.error(
            '[Swap Retry] Swap not found in history after checking up to 50 swaps',
          );
          continue;
        }

        // Get the lightning request
        const lightningRequest = await getSparkLightningPaymentStatus({
          lightningInvoiceId: sparkRequestID,
          mnemonic: mnemoinc,
        });

        if (!lightningRequest?.transfer?.sparkId) {
          console.error('[Swap Retry] Lightning request not found');
          await removePendingSwapConfirmation(sparkRequestID);
          continue;
        }

        // Get transaction details
        const txDetails = await getSingleTxDetails(
          mnemoinc,
          lightningRequest?.transfer?.sparkId,
        );

        if (!txDetails) {
          console.error('[Swap Retry] Transaction details not found');
          continue;
        }

        // Check if already completed
        if (isFlashnetTransfer(lightningRequest.transfer.sparkId)) {
          console.log('[Swap Retry] Already completed, removing');
          await removePendingSwapConfirmation(sparkRequestID);
          continue;
        }

        const result = {
          swap: {
            ...swap,
            feeAmount: swap.feePaid || 0,
            executionPrice: swap.price,
            amountOut: swap.amountOut,
          },
        };

        const invoice = lightningRequest?.invoice?.encodedInvoice || '';

        lightningRequest.description = lightningRequest?.invoice?.memo || '';

        const success = await completeSwapConfirmation(
          sparkRequestID,
          outboundTransferId,
          lightningRequest,
          txDetails,
          result,
          invoice,
          mnemoinc,
          sparkInfoRef,
        );

        if (success) {
          console.log(
            '[Swap Retry] Successfully completed pending confirmation',
          );
        } else {
          console.warn('[Swap Retry] Failed to complete confirmation');
        }

        // Add delay between retries
        await new Promise(res => setTimeout(res, 1000));
      } catch (err) {
        console.error(`[Swap Retry] Error processing ${sparkRequestID}:`, err);
      }
    }

    console.log('[Swap Retry] Finished processing pending confirmations');
  } catch (err) {
    console.error('[Swap Retry] Error in retry process:', err);
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate expected output for a given input amount
 * @param {string} mnemonic - Wallet mnemonic
 * @param {object} params - Calculation parameters
 * @returns {Promise<object>} Expected output
 */
export const calculateSwapOutput = async (
  mnemonic,
  { poolId, assetInAddress, assetOutAddress, amountIn },
) => {
  return await simulateSwap(mnemonic, {
    poolId,
    assetInAddress,
    assetOutAddress,
    amountIn,
  });
};

/**
 * Check if a swap is viable (sufficient liquidity, reasonable price impact)
 * @param {string} mnemonic - Wallet mnemonic
 * @param {object} params - Swap parameters
 * @param {number} maxPriceImpactPct - Maximum acceptable price impact %
 * @returns {Promise<object>} Viability check result
 */
export const checkSwapViability = async (
  mnemonic,
  params,
  maxPriceImpactPct = 5,
) => {
  try {
    const simulation = await simulateSwap(mnemonic, params);

    if (!simulation.didWork) {
      return {
        viable: false,
        reason: 'Simulation failed',
        error: simulation.error,
      };
    }

    const priceImpact = parseFloat(simulation.simulation.priceImpact);

    if (priceImpact > maxPriceImpactPct) {
      return {
        viable: false,
        reason: `Price impact too high: ${priceImpact.toFixed(
          2,
        )}% (max: ${maxPriceImpactPct}%)`,
        priceImpact,
        simulation: simulation.simulation,
      };
    }

    return {
      viable: true,
      priceImpact,
      simulation: simulation.simulation,
    };
  } catch (error) {
    return {
      viable: false,
      reason: error.message,
      error: formatError(error, 'checkSwapViability'),
    };
  }
};

/**
 * Get current price for a token pair
 * @param {string} mnemonic - Wallet mnemonic
 * @param {string} poolId - Pool ID
 * @returns {Promise<object>} Current price
 */
export const getCurrentPrice = async (mnemonic, poolId) => {
  try {
    const poolResult = await getPoolDetails(mnemonic, poolId);

    if (!poolResult.didWork) {
      throw new Error('Failed to get pool details');
    }

    return {
      didWork: true,
      price: poolResult.marketData.currentPrice,
      priceChange24h: poolResult.marketData.priceChange24h,
      volume24h: poolResult.marketData.volume24h,
      tvl: poolResult.marketData.tvl,
    };
  } catch (error) {
    console.warn(
      'Get current price error:',
      formatError(error, 'getCurrentPrice'),
    );
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'getCurrentPrice'),
    };
  }
};

/**
 * Convert sats to dollars
 * @param {string|number|bigint} sats - Amount of satoshis (100,000,000)
 * @param {string|number|bigint} currentPriceAinB - Price of Bitcoin in dollars
 * @returns {number} Amount in dollars
 */
export function satsToDollars(sats, currentPriceAinB) {
  try {
    const DOLLAR_DECIMALS = 1_000_000;

    const numSats = typeof sats === 'bigint' ? Number(sats) : Number(sats || 0);
    const numPrice =
      typeof currentPriceAinB === 'bigint'
        ? Number(currentPriceAinB)
        : Number(currentPriceAinB || 0);

    if (isNaN(numSats) || isNaN(numPrice) || numPrice === 0) {
      return 0;
    }

    return (numSats * numPrice) / DOLLAR_DECIMALS;
  } catch (error) {
    console.error('Error in satsToDollars:', error, { sats, currentPriceAinB });
    return 0;
  }
}

/**
 * Convert dollars to sats
 * @param {string|number|bigint} dollars - Amount of dollars (1,000,000)
 * @param {string|number|bigint} currentPriceAinB - Price of Bitcoin in dollars
 * @returns {number} Amount in sats
 */
export function dollarsToSats(dollars, currentPriceAinB) {
  try {
    const DOLLAR_DECIMALS = 1_000_000;

    const numDollars =
      typeof dollars === 'bigint' ? Number(dollars) : Number(dollars || 0);
    const numPrice =
      typeof currentPriceAinB === 'bigint'
        ? Number(currentPriceAinB)
        : Number(currentPriceAinB || 0);

    if (isNaN(numDollars) || isNaN(numPrice) || numPrice === 0) {
      return 0;
    }

    return (numDollars * DOLLAR_DECIMALS) / numPrice;
  } catch (error) {
    console.error('Error in dollarsToSats:', error, {
      dollars,
      currentPriceAinB,
    });
    return 0;
  }
}

/**
 * Convert exchangeRate to fiat price
 * @param {string|number|bigint} currentPriceAinB - Price of Bitcoin in dollars
 * @returns {number} Amount in dollars
 */
export function currentPriceAinBToPriceDollars(currentPriceAInB) {
  try {
    const numPrice =
      typeof currentPriceAInB === 'bigint'
        ? Number(currentPriceAInB)
        : Number(currentPriceAInB || 0);

    if (isNaN(numPrice)) {
      return 0;
    }

    return (numPrice * 100000000) / 1000000;
  } catch (error) {
    console.error('Error in currentPriceAinBToPriceDollars:', error, {
      currentPriceAInB,
    });
    return 0;
  }
}

// ============================================
// ERROR HANDLING UTILITIES
// ============================================

/**
 * Check if error is a Flashnet error and handle accordingly
 * @param {Error} error - The error to check
 * @returns {object} Error information
 */
export const handleFlashnetError = error => {
  if (!isFlashnetErrorCode(error.errorCode)) {
    return {
      isFlashnetError: false,
      message: error.message,
    };
  }
  const flashnetError = new FlashnetError(error.error, {
    response: {
      ...error,
    },
  });

  const errorInfo = {
    isFlashnetError: true,
    errorCode: flashnetError.errorCode,
    category: flashnetError.category,
    message: flashnetError.userMessage,
    userMessage: i18next.t(`flashnetUserMessages.${flashnetError.errorCode}`, {
      defaultValue: flashnetError.userMessage,
    }),
    actionHint: flashnetError.actionHint,
    isRetryable: flashnetError.isRetryable,
    recovery: flashnetError.recovery,
  };

  // Check for specific error types
  if (flashnetError.isSlippageError()) {
    errorInfo.type = 'slippage';
    errorInfo.userMessage = 'screens.inAccount.swapsPage.slippageError';
  } else if (flashnetError.isInsufficientLiquidityError()) {
    errorInfo.type = 'insufficient_liquidity';
    errorInfo.userMessage = 'screens.inAccount.swapsPage.noLiquidity';
  } else if (flashnetError.isAuthError()) {
    errorInfo.type = 'authentication';
    errorInfo.userMessage = 'screens.inAccount.swapsPage.authenticationError';
  } else if (flashnetError.isPoolNotFoundError()) {
    errorInfo.type = 'pool_not_found';
    errorInfo.userMessage = 'screens.inAccount.swapsPage.noPoolError';
  }
  errorInfo.userMessage = i18next.t(errorInfo.userMessage);

  // Check fund recovery status
  // if (flashnetError.wasClawbackAttempted?.()) {
  //   errorInfo.clawback = {
  //     attempted: true,
  //     allRecovered: flashnetError.wereAllTransfersRecovered?.() || false,
  //     partialRecovered:
  //       flashnetError.werePartialTransfersRecovered?.() || false,
  //     recoveredCount: flashnetError.getRecoveredTransferCount?.() || 0,
  //   };

  //   if (errorInfo.clawback.allRecovered) {
  //     errorInfo.userMessage =
  //       i18next.t(errorInfo.userMessage) +
  //       ' ' +
  //       i18next.t('screens.inAccount.swapsPage.automaticRecovery');
  //   } else if (errorInfo.clawback.partialRecovered) {
  //     errorInfo.userMessage =
  //       i18next.t(errorInfo.userMessage) +
  //       ' ' +
  //       i18next.t('screens.inAccount.swapsPage.semiRecovered');
  //   }
  // } else if (flashnetError.willAutoRefund?.()) {
  //   errorInfo.autoRefund = true;
  //   errorInfo.userMessage =
  //     i18next.t(errorInfo.userMessage) +
  //     ' ' +
  //     i18next.t('screens.inAccount.swapsPage.willRecover');
  // }

  return errorInfo;
};

/**
 * Get refund txid from error message
 * @param {string} error - The error to check
 * @returns {txid|undefined} transaction id
 */

const getRefundTxidFromErrormessage = message => {
  try {
    const match = message.match(FLASHNET_REFUND_REGEX);

    if (match) {
      const transferID = match[1]; // first capture group
      return transferID;
    } else {
      console.log('No transfer ID found');
    }
  } catch (err) {
    console.log('error getting txid from error message', err);
  }
};

/**
 * Format and return errormessage from webview
 * @param {Object} error - The error to check
 * @returns {Object} error response
 */

const formatAndReturnWebviewError = receivedError => {
  try {
    if (receivedError.formatted) {
      console.log(receivedError.formatted.errorCode);
      const error = handleFlashnetError(receivedError.formatted);

      return {
        didWork: false,
        error: receivedError.error,
        details: error,
      };
    }
  } catch (err) {
    console.log('error getting txid from error message', err);
  }
};

// ============================================
// MANUAL CLAWBACK & RECOVERY
// ============================================

/**
 * Manually request clawback for a failed swap
 * @param {string} mnemonic - Wallet mnemonic
 * @param {string} sparkTransferId - Transfer ID to recover
 * @param {string} poolId - Pool ID where funds are stuck
 * @returns {Promise<object>} Clawback result
 */
export const requestManualClawback = async (
  mnemonic,
  sparkTransferId,
  poolId,
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);

    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.requestClawback,
        { mnemonic, sparkTransferId, poolId },
      );
      return validateWebViewResponse(response, 'Not able to request clawback');
    } else {
      const client = getFlashnetClient(mnemonic);

      console.log({
        sparkTransferId,
        poolId,
      });
      const result = await client.clawback({
        sparkTransferId,
        lpIdentityPublicKey: poolId,
      });

      if (!result || result.error) {
        return {
          didWork: false,
          error: result?.error || 'Clawback request failed',
        };
      }

      if (result.accepted) {
        return {
          didWork: true,
          accepted: true,
          message: 'Clawback request accepted',
          internalRequestId: result.internalRequestId,
        };
      } else {
        return {
          didWork: false,
          accepted: false,
          error: result.error || 'Clawback request rejected by pool',
        };
      }
    }
  } catch (error) {
    console.warn(
      'Manual clawback error:',
      formatError(error, 'requestManualClawback'),
    );
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'requestManualClawback'),
    };
  }
};

/**
 * Manually request clawback Eligibility
 * @param {string} mnemonic - Wallet mnemonic
 * @param {string} sparkTransferId - Transfer ID to recover
 * @returns {Promise<object>} Clawback result
 */
export const checkClawbackEligibility = async (mnemonic, sparkTransferId) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);

    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.checkClawbackEligibility,
        { mnemonic, sparkTransferId },
      );
      return validateWebViewResponse(
        response,
        'Not able to checkClawbackEligibility',
      );
    } else {
      const client = getFlashnetClient(mnemonic);

      const eligibility = await client.checkClawbackEligibility({
        sparkTransferId,
      });

      if (eligibility.accepted) {
        console.log('Transfer is eligible for clawback');
        return {
          didWork: true,
          error: null,
          response: true,
        };
      } else {
        console.log('Cannot clawback:', eligibility.error);
        return {
          didWork: true,
          error: eligibility.error,
          response: false,
        };
      }
    }
  } catch (error) {
    console.warn(
      'Manual clawback error:',
      formatError(error, 'requestManualClawback'),
    );
    return {
      didWork: false,
      error: error.message,
      response: false,
    };
  }
};

/**
 * Check status of a manual clawback request
 * @param {string} mnemonic - Wallet mnemonic
 * @param {string} internalRequestId - Request ID from clawback request
 * @returns {Promise<object>} Clawback status
 */
export const checkClawbackStatus = async (mnemonic, internalRequestId) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);

    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.checkClawbackStatus,
        { mnemonic, internalRequestId },
      );
      return validateWebViewResponse(
        response,
        'Not able to check clawback status',
      );
    } else {
      const client = getFlashnetClient(mnemonic);
      const status = await client.checkClawbackStatus({ internalRequestId });

      return {
        didWork: true,
        status: status.status,
        transferId: status.transferId,
        isComplete: status.status === 'completed',
        isFailed: status.status === 'failed',
      };
    }
  } catch (error) {
    console.warn(
      'Check clawback status error:',
      formatError(error, 'checkClawbackStatus'),
    );
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'checkClawbackStatus'),
    };
  }
};

/**
 * Batch request clawback for multiple transfers
 * @param {string} mnemonic - Wallet mnemonic
 * @param {Array<{transferId: string, poolId: string}>} transfers - Transfers to recover
 * @returns {Promise<object>} Batch clawback results
 */
export const requestBatchClawback = async (mnemonic, transferIds, poolId) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);

    console.log(runtime, mnemonic, transferIds, poolId);
    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.requestBatchClawback,
        { mnemonic, transferIds, poolId },
      );
      return validateWebViewResponse(
        response,
        'Not able to check clawback status',
      );
    } else {
      const client = getFlashnetClient(mnemonic);
      const result = await client.clawbackMultiple(transferIds, poolId);

      return {
        didWork: true,
        result,
      };
    }
  } catch (error) {
    console.warn(
      'Batch clawback error:',
      formatError(error, 'requestBatchClawback'),
    );
    return {
      didWork: false,
      error: error.message,
    };
  }
};

/**
 * Batch request clawback for multiple transfers
 * @param {string} mnemonic - Wallet mnemonic
 * @param {Array<{transferId: string, poolId: string}>} transfers - Transfers to recover
 * @returns {Promise<object>} Batch clawback results
 */
export const listClawbackableTransfers = async (
  mnemonic,
  limit = 100,
  offset,
) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);

    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.listClawbackableTransfers,
        { mnemonic, limit },
      );
      return validateWebViewResponse(
        response,
        'Not able to listClawbackableTransfers',
      );
    } else {
      const client = getFlashnetClient(mnemonic);
      const resposne = await client.listClawbackableTransfers({ limit });

      return {
        didWork: true,
        resposne: resposne,
      };
    }
  } catch (error) {
    console.warn(
      'Check clawback status error:',
      formatError(error, 'checkClawbackStatus'),
    );
    return {
      didWork: false,
      error: error.message,
      details: formatError(error, 'checkClawbackStatus'),
    };
  }
};

// Export all functions
export default {
  // Pool functions
  findBestPool,
  getPoolDetails,
  listAllPools,

  // Swap functions
  simulateSwap,
  executeSwap,
  swapBitcoinToToken,
  swapTokenToBitcoin,

  // Lightning functions
  getLightningPaymentQuote,
  payLightningWithToken,

  // History functions
  getUserSwapHistory,

  // Utility functions
  // calculateSwapOutput,
  // checkSwapViability,
  // getCurrentPrice,
  handleFlashnetError,
  satsToDollars,
  dollarsToSats,

  // Manual recovery functions
  requestManualClawback,
  checkClawbackStatus,
  requestBatchClawback,
};
