import { EventEmitter } from 'events';
import {
  Client,
  InMemoryWalletStorage,
  InMemorySwapStorage,
} from '@lendasat/lendaswap-sdk-pure';

// ============================================================================
// Swap Status Constants
// ============================================================================

export const SwapStatus = {
  PENDING: 'pending',
  WAITING_PAYMENT: 'waiting_payment',
  CONFIRMING: 'confirming',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
  REFUNDED: 'refunded',
  SERVER_FUNDED: 'serverfunded',
};

// ============================================================================
// Custom Error Classes
// ============================================================================

export class LendaswapError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'LendaswapError';
    this.code = code;
    this.details = details;
  }
}

export class NetworkError extends LendaswapError {
  constructor(message, details = null) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends LendaswapError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class InsufficientFundsError extends LendaswapError {
  constructor(message, details = null) {
    super(message, 'INSUFFICIENT_FUNDS', details);
    this.name = 'InsufficientFundsError';
  }
}

// ============================================================================
// LendaswapService Class
// ============================================================================

export class LendaswapService extends EventEmitter {
  constructor(config) {
    super();

    this.config = {
      mnemonic: config.mnemonic || null,
      storageAdapter: config.storageAdapter,
    };

    this.client = null;
    this.initialized = false;
    this.activeSwaps = new Map();
    this.pollIntervals = new Map();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the Lendaswap client
   * @returns {Promise<Object>} Client info
   */
  async initialize() {
    try {
      const builder = Client.builder()
        .withSignerStorage(new InMemoryWalletStorage())
        .withSwapStorage(new InMemorySwapStorage());

      // Add mnemonic if provided
      if (this.config.mnemonic) {
        builder.withMnemonic(this.config.mnemonic);
      }

      const sdkClient = await builder.build();

      this.client = sdkClient;
      this.initialized = true;

      const mnemonic = sdkClient.getMnemonic();

      this.emit('initialized', { mnemonic });
      return { initialized: true, mnemonic };
    } catch (error) {
      throw this.handleError(error, 'Failed to initialize Lendaswap client');
    }
  }

  /**
   * Ensure client is initialized
   * @private
   */
  ensureInitialized() {
    if (!this.initialized || !this.client) {
      throw new LendaswapError(
        'Client not initialized. Call initialize() first.',
        'NOT_INITIALIZED',
      );
    }
  }

  /**
   * Get the mnemonic from the client
   * @returns {string}
   */
  getMnemonic() {
    this.ensureInitialized();
    return this.client.getMnemonic();
  }

  // ==========================================================================
  // Trading Pairs & Tokens
  // ==========================================================================

  /**
   * Get all available asset pairs
   * @returns {Promise<Array>}
   */
  async getAssetPairs() {
    this.ensureInitialized();

    try {
      const pairs = await this.client.getAssetPairs();
      return pairs;
    } catch (error) {
      throw this.handleError(error, 'Failed to get asset pairs');
    }
  }

  // ==========================================================================
  // Quote Management
  // ==========================================================================

  /**
   * Get a swap quote
   * @param {string} fromToken - Source token (e.g., 'btc_lightning')
   * @param {string} toToken - Destination token (e.g., 'usdc_pol')
   * @param {number} amount - Amount in smallest unit (sats for BTC)
   * @returns {Promise<Object>}
   */
  async getQuote(fromToken, toToken, amount) {
    this.ensureInitialized();

    try {
      this.validateQuoteParams({ fromToken, toToken, amount });

      const quote = await this.client.getQuote(fromToken, toToken, amount);

      return quote;
    } catch (error) {
      throw this.handleError(error, 'Failed to get quote');
    }
  }

  // ==========================================================================
  // Swap Execution
  // ==========================================================================

  /**
   * Create a Lightning to EVM swap
   * @param {Object} params - Swap parameters
   * @param {string} params.targetAddress - Destination EVM address
   * @param {string} params.targetToken - Target token (e.g., 'usdc_pol', 'usdt_pol')
   * @param {string} params.targetChain - Target chain ('polygon' or 'arbitrum')
   * @param {number} params.sourceAmount - Amount in sats
   * @returns {Promise<Object>}
   */
  async createLightningToEvmSwap({
    targetAddress,
    targetToken,
    targetChain,
    sourceAmount,
  }) {
    this.ensureInitialized();

    try {
      this.validateSwapParams({
        targetAddress,
        targetToken,
        targetChain,
        sourceAmount,
      });

      const result = await this.client.createLightningToEvmSwap({
        targetAddress,
        targetToken,
        targetChain,
        sourceAmount,
      });

      const swap = result.response;
      const swapId = swap.id || swap.swapId;

      // Track swap
      this.activeSwaps.set(swapId, swap);
      this.emit('swapCreated', swap);

      // Start monitoring
      this.startSwapMonitoring(swapId);

      return result;
    } catch (error) {
      throw this.handleError(error, 'Failed to create swap');
    }
  }

  // ==========================================================================
  // Swap Management
  // ==========================================================================

  /**
   * Get swap details by ID
   * @param {string} swapId - Swap ID
   * @returns {Promise<Object>}
   */
  async getSwap(swapId) {
    this.ensureInitialized();

    try {
      const swap = await this.client.getSwap(swapId);

      this.activeSwaps.set(swapId, swap);
      return swap;
    } catch (error) {
      throw this.handleError(error, 'Failed to get swap details');
    }
  }

  /**
   * Get stored swaps from storage
   * @returns {Promise<Array>}
   */
  async getStoredSwaps() {
    this.ensureInitialized();

    try {
      if (!this.client.getStoredSwaps) {
        return [];
      }
      const swaps = await this.client.getStoredSwaps();
      return Array.isArray(swaps) ? swaps : [];
    } catch (error) {
      throw this.handleError(error, 'Failed to get stored swaps');
    }
  }

  /**
   * Claim an EVM swap
   * @param {string} swapId - Swap ID
   * @returns {Promise<Object>}
   */
  async claim(swapId) {
    this.ensureInitialized();

    try {
      const result = await this.client.claim(swapId);

      const swap = await this.getSwap(swapId);
      this.emit('swapClaimed', swap);

      return result;
    } catch (error) {
      throw this.handleError(error, 'Failed to claim swap');
    }
  }

  // ==========================================================================
  // Real-time Monitoring
  // ==========================================================================

  /**
   * Start monitoring a swap for status updates
   * @private
   * @param {string} swapId
   */
  startSwapMonitoring(swapId) {
    if (this.pollIntervals.has(swapId)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const swap = await this.getSwap(swapId);

        const previousSwap = this.activeSwaps.get(swapId);
        if (previousSwap && previousSwap.status !== swap.status) {
          this.emit('swapStatusChanged', swap);
        }

        this.activeSwaps.set(swapId, swap);

        // Stop monitoring if swap is in final state
        if (this.isSwapFinal(swap.status)) {
          this.stopSwapMonitoring(swapId);
          this.emit('swapCompleted', swap);
        }
      } catch (error) {
        this.emit('swapError', { swapId, error });
      }
    }, 5000); // Poll every 5 seconds

    this.pollIntervals.set(swapId, interval);
  }

  /**
   * Stop monitoring a swap
   * @private
   * @param {string} swapId
   */
  stopSwapMonitoring(swapId) {
    const interval = this.pollIntervals.get(swapId);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(swapId);
    }
  }

  /**
   * Check if swap is in final state
   * @private
   * @param {string} status
   * @returns {boolean}
   */
  isSwapFinal(status) {
    return [
      SwapStatus.COMPLETED,
      SwapStatus.FAILED,
      SwapStatus.EXPIRED,
      SwapStatus.REFUNDED,
    ].includes(status);
  }

  /**
   * Stop all monitoring
   */
  stopAllMonitoring() {
    this.pollIntervals.forEach(interval => clearInterval(interval));
    this.pollIntervals.clear();
  }

  // ==========================================================================
  // Utilities & Helpers
  // ==========================================================================

  /**
   * Validate quote parameters
   * @private
   */
  validateQuoteParams({ fromToken, toToken, amount }) {
    if (!fromToken || typeof fromToken !== 'string') {
      throw new ValidationError('Invalid fromToken');
    }

    if (!toToken || typeof toToken !== 'string') {
      throw new ValidationError('Invalid toToken');
    }

    if (!amount || isNaN(parseInt(amount)) || parseInt(amount) <= 0) {
      throw new ValidationError('Invalid amount');
    }
  }

  /**
   * Validate swap parameters
   * @private
   */
  validateSwapParams({
    targetAddress,
    targetToken,
    targetChain,
    sourceAmount,
  }) {
    if (!targetAddress || typeof targetAddress !== 'string') {
      throw new ValidationError('Invalid target address');
    }

    if (!targetToken || typeof targetToken !== 'string') {
      throw new ValidationError('Invalid target token');
    }

    if (!targetChain || !['polygon', 'arbitrum'].includes(targetChain)) {
      throw new ValidationError(
        'Invalid target chain. Must be "polygon" or "arbitrum"',
      );
    }

    if (
      !sourceAmount ||
      isNaN(parseInt(sourceAmount)) ||
      parseInt(sourceAmount) <= 0
    ) {
      throw new ValidationError('Invalid source amount');
    }
  }

  /**
   * Handle and format errors
   * @private
   */
  handleError(error, context) {
    if (error instanceof LendaswapError) {
      return error;
    }

    const message = error.message || context;
    const code = error.code || 'UNKNOWN_ERROR';

    if (code === 'INSUFFICIENT_FUNDS' || message.includes('insufficient')) {
      return new InsufficientFundsError(message);
    }

    if (code === 'VALIDATION_ERROR' || message.includes('invalid')) {
      return new ValidationError(message);
    }

    if (code === 'NETWORK_ERROR' || message.includes('network')) {
      return new NetworkError(message);
    }

    return new LendaswapError(message, code, error);
  }

  /**
   * Get active swaps
   * @returns {Array}
   */
  getActiveSwaps() {
    return Array.from(this.activeSwaps.values());
  }

  /**
   * Clear active swaps cache
   */
  clearCache() {
    this.activeSwaps.clear();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopAllMonitoring();
    this.clearCache();
    this.removeAllListeners();
    this.initialized = false;
    this.config.mnemonic = null;
    this.client = null;
  }
}
