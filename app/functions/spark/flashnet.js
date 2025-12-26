// ============================================
// IMPROVED FLASHNET SWAP & LIGHTNING PAYMENT FUNCTIONS
// Based on Official Flashnet SDK Documentation v0.4.2+
// ============================================

import { FlashnetClient, isFlashnetError } from '@flashnet/sdk';
import { getFlashnetClient, selectSparkRuntime } from '.';

// ============================================
// CONSTANTS
// ============================================

// Standard Bitcoin pubkey for pools (constant across Flashnet)
export const BTC_ASSET_ADDRESS =
  '020202020202020202020202020202020202020202020202020202020202020202';
export const USD_ASSET_ADDRESS =
  '3206c93b24a4d18ea19d0a9a213204af2c7e74a6d16c7535cc5d33eca4ad1eca';

// Default slippage tolerance
export const DEFAULT_SLIPPAGE_BPS = 500; // 5%
export const DEFAULT_MAX_SLIPPAGE_BPS = 500; // 5% for lightning payments

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Safely convert to BigInt
 */
const toBigInt = value => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.floor(value));
  if (typeof value === 'string') return BigInt(value);
  throw new Error(`Cannot convert ${typeof value} to BigInt`);
};

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
      actionHint: error.actionHint,
      requestId: error.requestId,
      isRetryable: error.isRetryable,
      recovery: error.recovery,
      transferIds: error.transferIds,
      clawbackAttempted: error.wasClawbackAttempted?.() || false,
      fundsRecovered: error.wereAllTransfersRecovered?.() || false,
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
const calculateMinOutput = (expectedOutput, slippageBps) => {
  const output = BigInt(expectedOutput);
  const factor = 10_000n - BigInt(slippageBps);
  return (output * factor) / 10_000n;
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
      throw new Error(`No pools found for ${tokenAAddress}/${tokenBAddress}`);
    }

    // Return the best pool (highest TVL)
    return {
      didWork: true,
      pool: pools.pools[0],
      totalAvailable: pools.totalCount,
    };
  } catch (error) {
    console.error('Find best pool error:', formatError(error, 'findBestPool'));
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
  } catch (error) {
    console.error(
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
  } catch (error) {
    console.error('List pools error:', formatError(error, 'listAllPools'));
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
      return validateWebViewResponse(response, 'Not able to request clawback');
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
    console.error(
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
  { poolId, assetInAddress, assetOutAddress, amountIn },
) => {
  try {
    const client = getFlashnetClient(mnemonic);

    const simulation = await client.simulateSwap({
      poolId,
      assetInAddress,
      assetOutAddress,
      amountIn: amountIn.toString(),
    });

    return {
      didWork: true,
      simulation: {
        expectedOutput: simulation.amountOut,
        executionPrice: simulation.executionPrice,
        priceImpact: simulation.priceImpactPct,
        poolId: simulation.poolId,
      },
    };
  } catch (error) {
    console.error('Simulate swap error:', formatError(error, 'simulateSwap'));
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
    const client = getFlashnetClient(mnemonic);

    // Simulate first if minAmountOut not provided
    let calculatedMinOut = minAmountOut;
    if (!calculatedMinOut) {
      const simulation = await client.simulateSwap({
        poolId,
        assetInAddress,
        assetOutAddress,
        amountIn: amountIn.toString(),
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
      maxSlippageBps: 500,
      integratorFeeRateBps,
      integratorPublicKey: process.env.BLITZ_SPARK_PUBLICKEY,
    });

    console.log(swap, 'swap response');

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
  } catch (error) {
    const errorDetails = formatError(error, 'executeSwap');
    console.error('Execute swap error:', errorDetails);

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
  } catch (error) {
    console.error(
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
    // Find best pool if not provided
    let targetPoolId = poolId;
    if (!targetPoolId) {
      const poolResult = await findBestPool(
        mnemonic,
        tokenAddress,
        BTC_ASSET_ADDRESS,
      );
      if (!poolResult.didWork) {
        throw new Error('No suitable pool found for ' + tokenAddress + '/BTC');
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
  } catch (error) {
    console.error(
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
) => {
  try {
    const client = getFlashnetClient(mnemonic);

    const quote = await client.getPayLightningWithTokenQuote(
      invoice,
      tokenAddress,
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
      },
    };
  } catch (error) {
    console.error(
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
  } catch (error) {
    console.error(
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
export const getUserSwapHistory = async (mnemonic, limit = 50) => {
  try {
    const client = getFlashnetClient(mnemonic);

    const result = await client.getUserSwapHistory({ limit });

    return {
      didWork: true,
      swaps: result.swaps || [],
      totalCount: result.totalCount || 0,
    };
  } catch (error) {
    console.error(
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

/**
 * Get swap history for a specific pool
 * @param {string} mnemonic - Wallet mnemonic
 * @param {string} poolId - Pool's lpPublicKey
 * @param {number} limit - Number of swaps to retrieve
 * @returns {Promise<object>} Pool swap history
 */
export const getPoolSwapHistory = async (mnemonic, poolId, limit = 100) => {
  try {
    const client = getFlashnetClient(mnemonic);

    const result = await client.getPoolSwapHistory({ poolId, limit });

    return {
      didWork: true,
      swaps: result.swaps || [],
      totalCount: result.totalCount || 0,
      poolId,
    };
  } catch (error) {
    console.error(
      'Get pool swap history error:',
      formatError(error, 'getPoolSwapHistory'),
    );
    return {
      didWork: false,
      error: error.message,
      swaps: [],
      details: formatError(error, 'getPoolSwapHistory'),
    };
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
    console.error(
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

// ============================================
// ERROR HANDLING UTILITIES
// ============================================

/**
 * Check if error is a Flashnet error and handle accordingly
 * @param {Error} error - The error to check
 * @returns {object} Error information
 */
export const handleFlashnetError = error => {
  if (!isFlashnetError(error)) {
    return {
      isFlashnetError: false,
      message: error.message,
    };
  }

  const errorInfo = {
    isFlashnetError: true,
    errorCode: error.errorCode,
    category: error.category,
    message: error.userMessage,
    actionHint: error.actionHint,
    isRetryable: error.isRetryable,
    recovery: error.recovery,
  };

  // Check for specific error types
  if (error.isSlippageError()) {
    errorInfo.type = 'slippage';
    errorInfo.userMessage =
      'Price moved too much. Try increasing slippage tolerance.';
  } else if (error.isInsufficientLiquidityError()) {
    errorInfo.type = 'insufficient_liquidity';
    errorInfo.userMessage =
      'Not enough liquidity. Try a smaller amount or different pool.';
  } else if (error.isAuthError()) {
    errorInfo.type = 'authentication';
    errorInfo.userMessage = 'Authentication failed. Please reconnect.';
  } else if (error.isPoolNotFoundError()) {
    errorInfo.type = 'pool_not_found';
    errorInfo.userMessage = 'Pool does not exist.';
  }

  // Check fund recovery status
  if (error.wasClawbackAttempted?.()) {
    errorInfo.clawback = {
      attempted: true,
      allRecovered: error.wereAllTransfersRecovered?.() || false,
      partialRecovered: error.werePartialTransfersRecovered?.() || false,
      recoveredCount: error.getRecoveredTransferCount?.() || 0,
    };

    if (errorInfo.clawback.allRecovered) {
      errorInfo.userMessage =
        errorInfo.userMessage + ' Funds recovered automatically.';
    } else if (errorInfo.clawback.partialRecovered) {
      errorInfo.userMessage =
        errorInfo.userMessage + ' Some funds need manual recovery.';
    }
  } else if (error.willAutoRefund?.()) {
    errorInfo.autoRefund = true;
    errorInfo.userMessage =
      errorInfo.userMessage + ' Funds will be returned automatically.';
  }

  return errorInfo;
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
    console.error(
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
        OPERATION_TYPES.requestClawback,
        { mnemonic, sparkTransferId, poolId },
      );
      return validateWebViewResponse(response, 'Not able to request clawback');
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
    console.error(
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
    console.error(
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
export const requestBatchClawback = async (mnemonic, transfers) => {
  try {
    const results = await Promise.allSettled(
      transfers.map(({ transferId, poolId }) =>
        requestManualClawback(mnemonic, transferId, poolId),
      ),
    );

    const successful = results.filter(
      r => r.status === 'fulfilled' && r.value.didWork,
    ).length;
    const failed = results.length - successful;

    return {
      didWork: true,
      totalRequests: results.length,
      successful,
      failed,
      results: results.map((r, i) => ({
        transferId: transfers[i].transferId,
        status: r.status,
        result: r.status === 'fulfilled' ? r.value : { error: r.reason },
      })),
    };
  } catch (error) {
    console.error(
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
export const listClawbackableTransfers = async (mnemonic, limit, offset) => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);

    if (runtime === 'webview') {
      const response = await sendWebViewRequestGlobal(
        OPERATION_TYPES.listClawbackableTransfers,
        { mnemonic, internalRequestId },
      );
      return validateWebViewResponse(
        response,
        'Not able to check clawback status',
      );
    } else {
      const client = getFlashnetClient(mnemonic);
      const resposne = await client.listClawbackableTransfers({ limit: 100 });

      return {
        didWork: true,
        resposne: resposne,
      };
    }
  } catch (error) {
    console.error(
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
  getPoolSwapHistory,

  // Utility functions
  calculateSwapOutput,
  checkSwapViability,
  getCurrentPrice,
  handleFlashnetError,

  // Manual recovery functions
  requestManualClawback,
  checkClawbackStatus,
  requestBatchClawback,
};
