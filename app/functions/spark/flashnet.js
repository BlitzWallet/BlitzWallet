import { FlashnetClient } from '@flashnet/sdk';

/**
 * Creates Flashnet AMM functions for USDB swaps and lightning payments
 * @param {Object} sparkWallet - Initialized Spark wallet instance
 * @returns {Object} Object containing all Flashnet swap and lightning functions
 */
const createFlashnetAPI = sparkWallet => {
  let flashnetClient = null;

  /**
   * Initialize the Flashnet client with the Spark wallet
   */
  const initializeFlashnetClient = async () => {
    try {
      if (flashnetClient) {
        return { didWork: true, message: 'Client already initialized' };
      }

      flashnetClient = new FlashnetClient(sparkWallet);
      await flashnetClient.initialize();

      return {
        didWork: true,
        message: 'Flashnet client initialized successfully',
      };
    } catch (err) {
      console.error('Initialize Flashnet client error:', err);
      return { didWork: false, error: err.message };
    }
  };

  /**
   * Get client instance (throws if not initialized)
   */
  const getClient = () => {
    if (!flashnetClient) {
      throw new Error(
        'Flashnet client not initialized. Call initializeFlashnetClient first.',
      );
    }
    return flashnetClient;
  };

  /**
   * List available pools, optionally filtered
   * @param {Object} filters - Optional filters { assetA, assetB, poolType }
   */
  const listPools = async (filters = {}) => {
    try {
      const client = getClient();
      const pools = await client.listPools(filters);
      return { didWork: true, pools };
    } catch (err) {
      console.error('List pools error:', err);
      return { didWork: false, error: err.message };
    }
  };

  /**
   * Get details of a specific pool
   * @param {string} poolId - The pool public key
   */
  const getPoolDetails = async ({ poolId }) => {
    try {
      const client = getClient();
      const pool = await client.getPool(poolId);
      return { didWork: true, pool };
    } catch (err) {
      console.error('Get pool details error:', err);
      return { didWork: false, error: err.message };
    }
  };

  // ============================================
  // BITCOIN <-> USDB SWAP FUNCTIONS
  // ============================================

  /**
   * Simulate a Bitcoin -> USDB swap
   * @param {string} poolId - Pool public key
   * @param {string} amountSats - Amount in satoshis to swap
   * @param {string} bitcoinPubkey - Bitcoin asset public key
   * @param {string} usdbPubkey - USDB token public key
   */
  const simulateBitcoinToUSDB = async ({
    poolId,
    amountSats,
    bitcoinPubkey,
    usdbPubkey,
  }) => {
    try {
      const client = getClient();

      const simulation = await client.simulateSwap({
        poolId,
        assetInAddress: bitcoinPubkey,
        assetOutAddress: usdbPubkey,
        amountIn: amountSats,
      });

      return {
        didWork: true,
        simulation: {
          amountIn: simulation.amountIn,
          amountOut: simulation.amountOut,
          priceImpact: simulation.priceImpactPct,
          fee: simulation.fee,
        },
      };
    } catch (err) {
      console.error('Simulate Bitcoin to USDB error:', err);
      return { didWork: false, error: err.message };
    }
  };

  /**
   * Execute a Bitcoin -> USDB swap
   * @param {string} poolId - Pool public key
   * @param {string} amountSats - Amount in satoshis to swap
   * @param {string} bitcoinPubkey - Bitcoin asset public key
   * @param {string} usdbPubkey - USDB token public key
   * @param {number} maxSlippageBps - Max slippage in basis points (100 = 1%)
   */
  const swapBitcoinToUSDB = async ({
    poolId,
    amountSats,
    bitcoinPubkey,
    usdbPubkey,
    maxSlippageBps = 100, // Default 1% slippage
  }) => {
    try {
      const client = getClient();

      // First simulate to get expected output
      const simulation = await client.simulateSwap({
        poolId,
        assetInAddress: bitcoinPubkey,
        assetOutAddress: usdbPubkey,
        amountIn: amountSats,
      });

      // Calculate minimum output with slippage tolerance
      const minAmountOut = (
        (BigInt(simulation.amountOut) * BigInt(10000 - maxSlippageBps)) /
        10000n
      ).toString();

      // Execute the swap
      const swap = await client.executeSwap({
        poolId,
        assetInAddress: bitcoinPubkey,
        assetOutAddress: usdbPubkey,
        amountIn: amountSats,
        minAmountOut,
        maxSlippageBps,
      });

      return {
        didWork: true,
        swap: {
          amountIn: swap.amountIn,
          amountOut: swap.amountOut,
          outboundTransferId: swap.outboundTransferId,
          priceImpact: simulation.priceImpactPct,
        },
      };
    } catch (err) {
      console.error('Swap Bitcoin to USDB error:', err);
      return { didWork: false, error: err.message };
    }
  };

  /**
   * Simulate a USDB -> Bitcoin swap
   * @param {string} poolId - Pool public key
   * @param {string} amountUSDB - Amount of USDB tokens to swap
   * @param {string} usdbPubkey - USDB token public key
   * @param {string} bitcoinPubkey - Bitcoin asset public key
   */
  const simulateUSDBToBitcoin = async ({
    poolId,
    amountUSDB,
    usdbPubkey,
    bitcoinPubkey,
  }) => {
    try {
      const client = getClient();

      const simulation = await client.simulateSwap({
        poolId,
        assetInAddress: usdbPubkey,
        assetOutAddress: bitcoinPubkey,
        amountIn: amountUSDB,
      });

      return {
        didWork: true,
        simulation: {
          amountIn: simulation.amountIn,
          amountOut: simulation.amountOut,
          priceImpact: simulation.priceImpactPct,
          fee: simulation.fee,
        },
      };
    } catch (err) {
      console.error('Simulate USDB to Bitcoin error:', err);
      return { didWork: false, error: err.message };
    }
  };

  /**
   * Execute a USDB -> Bitcoin swap
   * @param {string} poolId - Pool public key
   * @param {string} amountUSDB - Amount of USDB tokens to swap
   * @param {string} usdbPubkey - USDB token public key
   * @param {string} bitcoinPubkey - Bitcoin asset public key
   * @param {number} maxSlippageBps - Max slippage in basis points (100 = 1%)
   */
  const swapUSDBToBitcoin = async ({
    poolId,
    amountUSDB,
    usdbPubkey,
    bitcoinPubkey,
    maxSlippageBps = 100,
  }) => {
    try {
      const client = getClient();

      // First simulate to get expected output
      const simulation = await client.simulateSwap({
        poolId,
        assetInAddress: usdbPubkey,
        assetOutAddress: bitcoinPubkey,
        amountIn: amountUSDB,
      });

      // Calculate minimum output with slippage tolerance
      const minAmountOut = (
        (BigInt(simulation.amountOut) * BigInt(10000 - maxSlippageBps)) /
        10000n
      ).toString();

      // Execute the swap
      const swap = await client.executeSwap({
        poolId,
        assetInAddress: usdbPubkey,
        assetOutAddress: bitcoinPubkey,
        amountIn: amountUSDB,
        minAmountOut,
        maxSlippageBps,
      });

      return {
        didWork: true,
        swap: {
          amountIn: swap.amountIn,
          amountOut: swap.amountOut,
          outboundTransferId: swap.outboundTransferId,
          priceImpact: simulation.priceImpactPct,
        },
      };
    } catch (err) {
      console.error('Swap USDB to Bitcoin error:', err);
      return { didWork: false, error: err.message };
    }
  };

  // ============================================
  // USDB -> LIGHTNING PAYMENT FUNCTION
  // ============================================

  /**
   * Pay a Lightning invoice using USDB (swap USDB -> Bitcoin then pay invoice)
   * This is a two-step process:
   * 1. Swap USDB to Bitcoin via Flashnet AMM
   * 2. Pay Lightning invoice using the received Bitcoin
   *
   * @param {string} invoice - Lightning invoice to pay
   * @param {string} poolId - USDB/BTC pool public key
   * @param {string} usdbPubkey - USDB token public key
   * @param {string} bitcoinPubkey - Bitcoin asset public key
   * @param {string} amountUSDB - Amount of USDB to swap (if invoice has no amount)
   * @param {number} maxSwapSlippageBps - Max slippage for swap (default 100 = 1%)
   * @param {string} maxLightningFeeSats - Max fee for lightning payment in sats
   */
  const payLightningWithUSDB = async ({
    invoice,
    poolId,
    usdbPubkey,
    bitcoinPubkey,
    amountUSDB,
    maxSwapSlippageBps = 100,
    maxLightningFeeSats,
  }) => {
    try {
      const client = getClient();

      // Step 1: Get Lightning invoice details to know required amount
      const invoiceDetails = await client.wallet.decodeLightningInvoice(
        invoice,
      );

      const invoiceAmountSats = invoiceDetails.amountSats || null;

      // Step 2: Calculate USDB needed for the swap
      let usdbToSwap = amountUSDB;

      if (invoiceAmountSats && !amountUSDB) {
        // We need to simulate reverse: how much USDB for this amount of BTC?
        const simulation = await client.simulateSwap({
          poolId,
          assetInAddress: bitcoinPubkey,
          assetOutAddress: usdbPubkey,
          amountIn: invoiceAmountSats,
        });

        // Add buffer for slippage
        usdbToSwap = ((BigInt(simulation.amountOut) * 105n) / 100n).toString(); // 5% buffer
      }

      // Step 3: Swap USDB to Bitcoin
      const swapResult = await swapUSDBToBitcoin({
        poolId,
        amountUSDB: usdbToSwap,
        usdbPubkey,
        bitcoinPubkey,
        maxSlippageBps: maxSwapSlippageBps,
      });

      if (!swapResult.didWork) {
        throw new Error(`Swap failed: ${swapResult.error}`);
      }

      const bitcoinReceived = swapResult.swap.amountOut;

      // Step 4: Pay the Lightning invoice with the Bitcoin
      const lightningPayment = await client.wallet.payLightningInvoice({
        invoice: invoice.toLowerCase(),
        maxFeeSats: maxLightningFeeSats,
        amountSatsToSend: invoiceAmountSats || null,
        preferSpark: true,
      });

      return {
        didWork: true,
        result: {
          swap: {
            usdbSwapped: swapResult.swap.amountIn,
            bitcoinReceived: swapResult.swap.amountOut,
            swapTransferId: swapResult.swap.outboundTransferId,
          },
          lightning: {
            paymentHash: lightningPayment.paymentHash,
            paymentPreimage: lightningPayment.paymentPreimage,
            amountPaid: lightningPayment.amountSats,
            feePaid: lightningPayment.feeSats,
          },
        },
      };
    } catch (err) {
      console.error('Pay Lightning with USDB error:', err);
      return { didWork: false, error: err.message };
    }
  };

  /**
   * Estimate cost in USDB for paying a Lightning invoice
   * @param {string} invoice - Lightning invoice
   * @param {string} poolId - USDB/BTC pool public key
   * @param {string} usdbPubkey - USDB token public key
   * @param {string} bitcoinPubkey - Bitcoin asset public key
   */
  const estimateUSDBForLightningPayment = async ({
    invoice,
    poolId,
    usdbPubkey,
    bitcoinPubkey,
  }) => {
    try {
      const client = getClient();

      // Get invoice amount
      const invoiceDetails = await client.wallet.decodeLightningInvoice(
        invoice,
      );

      if (!invoiceDetails.amountSats) {
        return {
          didWork: false,
          error: 'Invoice has no amount specified. Please provide amountUSDB.',
        };
      }

      // Get Lightning fee estimate
      const lightningFee = await client.wallet.getLightningSendFeeEstimate({
        encodedInvoice: invoice.toLowerCase(),
        amountSats: invoiceDetails.amountSats,
      });

      const totalBitcoinNeeded =
        BigInt(invoiceDetails.amountSats) + BigInt(lightningFee.feeSats);

      // Simulate reverse swap to get USDB amount needed
      const simulation = await client.simulateSwap({
        poolId,
        assetInAddress: bitcoinPubkey,
        assetOutAddress: usdbPubkey,
        amountIn: totalBitcoinNeeded.toString(),
      });

      return {
        didWork: true,
        estimate: {
          invoiceAmount: invoiceDetails.amountSats,
          lightningFee: lightningFee.feeSats,
          totalBitcoinNeeded: totalBitcoinNeeded.toString(),
          usdbNeeded: simulation.amountOut,
          swapPriceImpact: simulation.priceImpactPct,
        },
      };
    } catch (err) {
      console.error('Estimate USDB for Lightning payment error:', err);
      return { didWork: false, error: err.message };
    }
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Get swap history for the user
   * @param {number} limit - Number of swaps to retrieve
   */
  const getUserSwapHistory = async ({ limit = 50 } = {}) => {
    try {
      const client = getClient();
      const history = await client.getUserSwaps(undefined, { limit });

      return {
        didWork: true,
        swaps: history.swaps,
        totalCount: history.totalCount,
      };
    } catch (err) {
      console.error('Get user swap history error:', err);
      return { didWork: false, error: err.message };
    }
  };

  /**
   * Get swap history for a specific pool
   * @param {string} poolId - Pool public key
   * @param {number} limit - Number of swaps to retrieve
   */
  const getPoolSwapHistory = async ({ poolId, limit = 100 }) => {
    try {
      const client = getClient();
      const history = await client.getPoolSwaps(poolId, { limit });

      return {
        didWork: true,
        swaps: history.swaps,
        totalCount: history.totalCount,
      };
    } catch (err) {
      console.error('Get pool swap history error:', err);
      return { didWork: false, error: err.message };
    }
  };

  return {
    // Initialization
    initializeFlashnetClient,

    // Pool queries
    listPools,
    getPoolDetails,

    // Bitcoin <-> USDB swaps
    simulateBitcoinToUSDB,
    swapBitcoinToUSDB,
    simulateUSDBToBitcoin,
    swapUSDBToBitcoin,

    // USDB -> Lightning payments
    payLightningWithUSDB,
    estimateUSDBForLightningPayment,

    // History
    getUserSwapHistory,
    getPoolSwapHistory,
  };
};

export const FlashnetAPI = createFlashnetAPI;
