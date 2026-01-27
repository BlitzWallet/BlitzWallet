import { EventEmitter } from 'events';
// import { ClientBuilder } from '@lendasat/lendaswap-sdk-native';

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
      apiUrl: config.apiUrl || 'https://apilendaswap.lendasat.com',
      network: config.network || 'bitcoin',
      arkadeUrl: config.arkadeUrl || 'https://arkade.computer',
      esploraUrl: config.esploraUrl || 'https://mempool.space/api',
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
   * @returns {Promise<Object>} Wallet info
   */
  async initialize() {
    try {
      // Build client with configuration
      const builder = new ClientBuilder()
        .storage(this.config.storageAdapter)
        .url(this.config.apiUrl)
        .network(this.config.network)
        .arkadeUrl(this.config.arkadeUrl)
        .esploraUrl(this.config.esploraUrl);

      this.client = builder.build();

      // Initialize with mnemonic (will generate new if not provided)
      await this.client.init(this.config.mnemonic);

      this.initialized = true;

      // Get wallet info
      const walletInfo = await this.getWalletInfo();

      this.emit('initialized', walletInfo);
      return walletInfo;
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

  // ==========================================================================
  // Wallet Management
  // ==========================================================================

  /**
   * Get wallet information
   * @returns {Promise<Object>}
   */
  async getWalletInfo() {
    this.ensureInitialized();

    try {
      const info = await this.client.getWalletInfo();
      return {
        bitcoinAddress: info.bitcoinAddress,
        lightningNodeId: info.lightningNodeId,
        mnemonic: info.mnemonic,
        network: this.config.network,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get wallet info');
    }
  }

  /**
   * Get wallet balance
   * @returns {Promise<Object>}
   */
  async getBalance() {
    this.ensureInitialized();

    try {
      const balance = await this.client.getBalance();
      return {
        confirmed: balance.confirmed || '0',
        unconfirmed: balance.unconfirmed || '0',
        total: balance.total || '0',
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get balance');
    }
  }

  // ==========================================================================
  // Trading Pairs & Tokens
  // ==========================================================================

  /**
   * Get all available trading pairs
   * @returns {Promise<Array>}
   */
  async getTradingPairs() {
    this.ensureInitialized();

    try {
      const pairs = await this.client.getPairs();
      return pairs.map(pair => ({
        id: pair.id,
        fromToken: pair.from_token,
        toToken: pair.to_token,
        minAmount: pair.min_amount,
        maxAmount: pair.max_amount,
        enabled: pair.enabled !== false,
      }));
    } catch (error) {
      throw this.handleError(error, 'Failed to get trading pairs');
    }
  }

  /**
   * Get all available tokens
   * @returns {Promise<Array>}
   */
  async getTokens() {
    this.ensureInitialized();

    try {
      const tokens = await this.client.getTokens();
      return tokens.map(token => ({
        symbol: token.symbol,
        name: token.name,
        network: token.network,
        decimals: token.decimals || 8,
        type: token.type,
      }));
    } catch (error) {
      throw this.handleError(error, 'Failed to get tokens');
    }
  }

  // ==========================================================================
  // Quote Management
  // ==========================================================================

  /**
   * Get a swap quote
   * @param {Object} params - Quote parameters
   * @param {string} params.fromToken - Source token (e.g., 'btc_lightning')
   * @param {string} params.toToken - Destination token (e.g., 'usdc_pol')
   * @param {string} params.amount - Amount in smallest unit (sats for BTC)
   * @returns {Promise<Object>}
   */
  async getQuote({ fromToken, toToken, amount }) {
    this.ensureInitialized();

    try {
      this.validateQuoteParams({ fromToken, toToken, amount });

      const quote = await this.client.getQuote(fromToken, toToken, amount);

      return {
        fromToken: quote.from_token,
        toToken: quote.to_token,
        amountIn: quote.amount_in,
        amountOut: quote.amount_out,
        exchangeRate: quote.exchange_rate,
        fee: quote.fee,
        networkFee: quote.network_fee || '0',
        expiresAt: quote.expires_at,
        minAmount: quote.min_amount,
        maxAmount: quote.max_amount,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get quote');
    }
  }

  // ==========================================================================
  // Swap Execution
  // ==========================================================================

  /**
   * Create a new swap
   * @param {Object} params - Swap parameters
   * @param {string} params.fromToken - Source token
   * @param {string} params.toToken - Destination token
   * @param {string} params.amount - Amount in smallest unit
   * @param {string} params.destinationAddress - Destination address
   * @param {string} [params.refundAddress] - Optional refund address
   * @returns {Promise<Object>}
   */
  async createSwap({
    fromToken,
    toToken,
    amount,
    destinationAddress,
    refundAddress,
  }) {
    this.ensureInitialized();

    try {
      this.validateSwapParams({
        fromToken,
        toToken,
        amount,
        destinationAddress,
      });

      const swap = await this.client.createSwap(
        fromToken,
        toToken,
        amount,
        destinationAddress,
        refundAddress,
      );

      const formattedSwap = this.formatSwap(swap);

      // Track swap
      this.activeSwaps.set(formattedSwap.id, formattedSwap);
      this.emit('swapCreated', formattedSwap);

      // Start monitoring
      this.startSwapMonitoring(formattedSwap.id);

      return formattedSwap;
    } catch (error) {
      throw this.handleError(error, 'Failed to create swap');
    }
  }

  /**
   * Send payment for a swap (for outgoing swaps)
   * @param {string} swapId - Swap ID
   * @returns {Promise<Object>}
   */
  async sendSwapPayment(swapId) {
    this.ensureInitialized();

    try {
      const result = await this.client.sendPayment(swapId);

      const swap = await this.getSwapDetails(swapId);
      this.emit('paymentSent', swap);

      return swap;
    } catch (error) {
      throw this.handleError(error, 'Failed to send payment');
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
  async getSwapDetails(swapId) {
    this.ensureInitialized();

    try {
      const swap = await this.client.getSwap(swapId);
      const formattedSwap = this.formatSwap(swap);

      this.activeSwaps.set(formattedSwap.id, formattedSwap);
      return formattedSwap;
    } catch (error) {
      throw this.handleError(error, 'Failed to get swap details');
    }
  }

  /**
   * Get all swaps from storage
   * @returns {Promise<Array>}
   */
  async getAllSwaps() {
    this.ensureInitialized();

    try {
      const swaps = await this.client.getSwaps();
      return swaps.map(swap => this.formatSwap(swap));
    } catch (error) {
      throw this.handleError(error, 'Failed to get swaps');
    }
  }

  /**
   * Get swaps with filters
   * @param {Object} filters
   * @param {string} [filters.status] - Filter by status
   * @param {string} [filters.fromToken] - Filter by source token
   * @param {string} [filters.toToken] - Filter by destination token
   * @returns {Promise<Array>}
   */
  async getSwaps(filters = {}) {
    this.ensureInitialized();

    try {
      let swaps = await this.getAllSwaps();

      // Apply filters
      if (filters.status) {
        swaps = swaps.filter(swap => swap.status === filters.status);
      }
      if (filters.fromToken) {
        swaps = swaps.filter(swap => swap.fromToken === filters.fromToken);
      }
      if (filters.toToken) {
        swaps = swaps.filter(swap => swap.toToken === filters.toToken);
      }

      // Sort by creation date (newest first)
      swaps.sort((a, b) => b.createdAt - a.createdAt);

      return swaps;
    } catch (error) {
      throw this.handleError(error, 'Failed to get filtered swaps');
    }
  }

  /**
   * Cancel a pending swap
   * @param {string} swapId - Swap ID
   * @returns {Promise<Object>}
   */
  async cancelSwap(swapId) {
    this.ensureInitialized();

    try {
      await this.client.cancelSwap(swapId);

      const swap = await this.getSwapDetails(swapId);

      this.activeSwaps.delete(swapId);
      this.stopSwapMonitoring(swapId);
      this.emit('swapCancelled', swap);

      return swap;
    } catch (error) {
      throw this.handleError(error, 'Failed to cancel swap');
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
        const swap = await this.getSwapDetails(swapId);

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
   * Format swap object from SDK response
   * @private
   * @param {Object} swap
   * @returns {Object}
   */
  formatSwap(swap) {
    return {
      id: swap.id,
      fromToken: swap.from_token,
      toToken: swap.to_token,
      status: swap.status,
      amountIn: swap.amount_in,
      amountOut: swap.amount_out,
      fee: swap.fee || '0',
      networkFee: swap.network_fee || '0',
      lightningInvoice: swap.lightning_invoice,
      lightningPaymentHash: swap.lightning_payment_hash,
      lightningPreimage: swap.lightning_preimage,
      chainTxHash: swap.chain_tx_hash,
      destinationAddress: swap.destination_address,
      refundAddress: swap.refund_address,
      createdAt: swap.created_at || Date.now(),
      updatedAt: swap.updated_at || Date.now(),
      expiresAt: swap.expires_at,
      errorMessage: swap.error_message,
    };
  }

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
  validateSwapParams({ fromToken, toToken, amount, destinationAddress }) {
    this.validateQuoteParams({ fromToken, toToken, amount });

    if (!destinationAddress || typeof destinationAddress !== 'string') {
      throw new ValidationError('Invalid destination address');
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
    this.client = null;
  }
}
