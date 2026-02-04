import { SwapStatus } from './lendaswapService';

// ============================================================================
// Token Information
// ============================================================================

export const TokenInfo = {
  btc_lightning: {
    name: 'Bitcoin Lightning',
    symbol: 'BTC',
    decimals: 8,
    icon: '⚡',
  },
  usdc_pol: {
    name: 'USD Coin (Polygon)',
    symbol: 'USDC',
    decimals: 6,
    icon: '💵',
  },
  usdt_pol: {
    name: 'Tether (Polygon)',
    symbol: 'USDT',
    decimals: 6,
    icon: '💵',
  },
};

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format amount with token info
 */
export function formatAmount(amount, tokenSymbol) {
  const info = TokenInfo[tokenSymbol];
  const decimals = info?.decimals || 8;
  const symbol = info?.symbol || tokenSymbol.toUpperCase();

  const num = parseInt(amount) / Math.pow(10, decimals);

  if (isNaN(num)) return `0 ${symbol}`;

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });

  return `${formatted} ${symbol}`;
}

/**
 * Format satoshis
 */
export function formatSats(sats) {
  const num = parseInt(sats);
  if (isNaN(num)) return '0 sats';

  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(8)} BTC`;
  }

  return `${num.toLocaleString('en-US')} sats`;
}

/**
 * Parse amount to smallest unit
 */
export function parseAmount(amount, tokenSymbol) {
  const info = TokenInfo[tokenSymbol];
  const decimals = info?.decimals || 8;

  const num = parseFloat(amount);
  if (isNaN(num)) return '0';

  const multiplier = Math.pow(10, decimals);
  return Math.floor(num * multiplier).toString();
}

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

/**
 * Format fee percentage
 */
export function formatFeePercent(fee, amount) {
  const feeNum = parseInt(fee);
  const amountNum = parseInt(amount);

  if (isNaN(feeNum) || isNaN(amountNum) || amountNum === 0) {
    return '0%';
  }

  const percent = (feeNum / amountNum) * 100;
  return `${percent.toFixed(2)}%`;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate amount string
 */
export function isValidAmount(amount) {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && isFinite(num);
}

/**
 * Validate Lightning invoice
 */
export function isValidLightningInvoice(invoice) {
  return (
    invoice && invoice.toLowerCase().startsWith('ln') && invoice.length > 20
  );
}

/**
 * Validate EVM wallet address
 */
export function isValidEVMAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Bitcoin address
 */
export function isValidBitcoinAddress(address) {
  // Basic validation for Bitcoin addresses
  return (
    /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || // Legacy
    /^bc1[a-z0-9]{39,59}$/.test(address)
  ); // Bech32
}

/**
 * Validate transaction hash
 */
export function isValidTxHash(hash) {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Validate token symbol
 */
export function isValidTokenSymbol(symbol) {
  return symbol && TokenInfo.hasOwnProperty(symbol);
}

// ============================================================================
// Conversion Utilities
// ============================================================================

/**
 * Convert satoshis to BTC
 */
export function satsToBTC(sats) {
  const num = typeof sats === 'string' ? parseInt(sats) : sats;
  return (num / 100000000).toFixed(8);
}

/**
 * Convert BTC to satoshis
 */
export function btcToSats(btc) {
  const num = typeof btc === 'string' ? parseFloat(btc) : btc;
  return Math.floor(num * 100000000).toString();
}

// ============================================================================
// Status Utilities
// ============================================================================

/**
 * Get status display text
 */
export function getStatusText(status) {
  const statusMap = {
    [SwapStatus.PENDING]: 'Pending',
    [SwapStatus.WAITING_PAYMENT]: 'Waiting Payment',
    [SwapStatus.CONFIRMING]: 'Confirming',
    [SwapStatus.PROCESSING]: 'Processing',
    [SwapStatus.COMPLETED]: 'Completed',
    [SwapStatus.FAILED]: 'Failed',
    [SwapStatus.EXPIRED]: 'Expired',
    [SwapStatus.REFUNDED]: 'Refunded',
  };

  return statusMap[status] || 'Unknown';
}

/**
 * Get status color for UI
 */
export function getStatusColor(status) {
  const colorMap = {
    [SwapStatus.PENDING]: '#FFA500',
    [SwapStatus.WAITING_PAYMENT]: '#4169E1',
    [SwapStatus.CONFIRMING]: '#4169E1',
    [SwapStatus.PROCESSING]: '#4169E1',
    [SwapStatus.COMPLETED]: '#28A745',
    [SwapStatus.FAILED]: '#DC3545',
    [SwapStatus.EXPIRED]: '#6C757D',
    [SwapStatus.REFUNDED]: '#FFC107',
  };

  return colorMap[status] || '#6C757D';
}

/**
 * Check if status is final (terminal state)
 */
export function isFinalStatus(status) {
  return [
    SwapStatus.COMPLETED,
    SwapStatus.FAILED,
    SwapStatus.EXPIRED,
    SwapStatus.REFUNDED,
  ].includes(status);
}

/**
 * Check if swap is cancellable
 */
export function isCancellable(status) {
  return [SwapStatus.PENDING, SwapStatus.WAITING_PAYMENT].includes(status);
}

// ============================================================================
// Direction Utilities
// ============================================================================

/**
 * Get swap direction text
 */
export function getDirectionText(fromToken, toToken) {
  const from = TokenInfo[fromToken]?.symbol || fromToken;
  const to = TokenInfo[toToken]?.symbol || toToken;
  return `${from} → ${to}`;
}

/**
 * Get direction icon
 */
export function getDirectionIcon(fromToken, toToken) {
  const fromIcon = TokenInfo[fromToken]?.icon || '🔗';
  const toIcon = TokenInfo[toToken]?.icon || '🔗';
  return `${fromIcon} → ${toIcon}`;
}

/**
 * Check if Lightning to Chain swap
 */
export function isLightningToChain(fromToken) {
  return fromToken.includes('lightning');
}

/**
 * Check if Chain to Lightning swap
 */
export function isChainToLightning(toToken) {
  return toToken.includes('lightning');
}

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Calculate time remaining in milliseconds
 */
export function getTimeRemaining(expiresAt) {
  return Math.max(0, expiresAt - Date.now());
}

/**
 * Format time remaining
 */
export function formatTimeRemaining(expiresAt) {
  const remaining = getTimeRemaining(expiresAt);

  if (remaining === 0) {
    return 'Expired';
  }

  const seconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Check if timestamp is expired
 */
export function isExpired(expiresAt) {
  return Date.now() >= expiresAt;
}

// ============================================================================
// URL & Display Utilities
// ============================================================================

/**
 * Get block explorer URL for transaction
 */
export function getExplorerUrl(txHash, network = 'polygon') {
  const explorers = {
    polygon: 'https://polygonscan.com/tx/',
    ethereum: 'https://etherscan.io/tx/',
    bitcoin: 'https://mempool.space/tx/',
  };

  const baseUrl = explorers[network] || explorers.polygon;
  return `${baseUrl}${txHash}`;
}

/**
 * Shorten address for display
 */
export function shortenAddress(address, chars = 4) {
  if (!address || address.length <= chars * 2 + 2) {
    return address;
  }
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// ============================================================================
// Calculation Utilities
// ============================================================================

/**
 * Calculate total cost including fees
 */
export function calculateTotalCost(amount, fee, networkFee) {
  const total = parseInt(amount) + parseInt(fee) + parseInt(networkFee);
  return total.toString();
}

/**
 * Calculate exchange rate
 */
export function calculateExchangeRate(
  amountIn,
  amountOut,
  decimalsIn = 8,
  decimalsOut = 6,
) {
  const inNum = parseInt(amountIn) / Math.pow(10, decimalsIn);
  const outNum = parseInt(amountOut) / Math.pow(10, decimalsOut);

  if (inNum === 0 || isNaN(inNum) || isNaN(outNum)) {
    return '0';
  }

  return (outNum / inNum).toFixed(6);
}

/**
 * Estimate receive amount (accounting for fees)
 */
export function estimateReceiveAmount(sendAmount, fee, networkFee) {
  const amount = parseInt(sendAmount);
  const feeAmount = parseInt(fee);
  const netFee = parseInt(networkFee);

  const received = amount - feeAmount - netFee;
  return Math.max(0, received).toString();
}

// ============================================================================
// QR Code Utilities
// ============================================================================

/**
 * Generate Bitcoin payment URI
 */
export function generateBitcoinURI(address, amount, label) {
  let uri = `bitcoin:${address}`;
  const params = [];

  if (amount) {
    params.push(`amount=${satsToBTC(amount)}`);
  }
  if (label) {
    params.push(`label=${encodeURIComponent(label)}`);
  }

  if (params.length > 0) {
    uri += '?' + params.join('&');
  }

  return uri;
}

/**
 * Parse Lightning invoice
 */
export function parseLightningInvoice(invoice) {
  try {
    // Basic invoice parsing (for display purposes)
    return {
      invoice: invoice,
      isValid: isValidLightningInvoice(invoice),
      network: invoice.toLowerCase().startsWith('lnbc') ? 'mainnet' : 'testnet',
    };
  } catch (error) {
    return {
      invoice: invoice,
      isValid: false,
      network: 'unknown',
    };
  }
}
