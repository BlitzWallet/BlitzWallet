export const ACCUMULATION_CHAINS = [
  { id: 'arbitrum', label: 'Arbitrum', assets: ['USDC', 'USDT'] },
  { id: 'base', label: 'Base', assets: ['USDC'] },
  { id: 'bsc', label: 'Binance', assets: ['USDC', 'USDT'] },
  { id: 'ethereum', label: 'Ethereum', assets: ['USDC', 'USDT'] },
  { id: 'optimism', label: 'Optimism', assets: ['USDC', 'USDT'] },
  { id: 'plasma', label: 'Plasma', assets: ['USDT'] },
  { id: 'polygon', label: 'Polygon', assets: ['USDC', 'USDT'] },
  { id: 'solana', label: 'Solana', assets: ['USDC', 'USDT'] },
  { id: 'tron', label: 'Tron', assets: ['USDT'] },
];
export const ACCUMULATION_DESTINATIONS = ['BTC', 'USDB'];

export const CHAIN_ASSET_ROW_HEIGHT = 65;
export const CHAIN_EXPAND_PADDING = 26;
export const getChainExpandHeight = chainId => {
  const chain = ACCUMULATION_CHAINS.find(c => c.id === chainId);
  if (!chain) return null;
  return chain.assets.length * CHAIN_ASSET_ROW_HEIGHT + CHAIN_EXPAND_PADDING;
};

export const MAX_ADDRESSES_PER_OPTION_FREE = 5;
export const MAX_ADDRESSES_PER_OPTION_PREMIUM = 20;

// ponytail: premium flag not built yet; reads a future masterInfoObject field.
// When premium ships, only this function changes.
export const getAccumulationAddressLimit = masterInfoObject =>
  masterInfoObject?.isPremium
    ? MAX_ADDRESSES_PER_OPTION_PREMIUM
    : MAX_ADDRESSES_PER_OPTION_FREE;

// Stable key identifying one option.
export const getPairKey = a =>
  `${a.sourceChain}:${a.sourceAsset}:${a.destinationAsset}`;

// Pure decision logic for createAddress (reuse vs cap vs mint).
export const resolveCreateAddressAction = ({ matching, forceNew, limit }) => {
  if (!forceNew && matching.length)
    return { type: 'reuse', address: matching[0].depositAddress };
  if (matching.length >= limit) return { type: 'limit_reached' };
  return { type: 'mint' };
};

// Reindex throttle: one rescan per address per 15 min so a user tapping the
// button repeatedly can't spam FlashNet.
export const REINDEX_WINDOW_MS = 15 * 60 * 1000;
export const REINDEX_TIMES_KEY = 'ACCUMULATION_REINDEX_TIMES';

// map: { [depositAddress]: windowStartMs }
export const getReindexThrottle = (map, address, now) => {
  const last = map?.[address];
  if (!last) return { throttled: false, remainingMs: 0 };
  const remainingMs = REINDEX_WINDOW_MS - (now - last);
  return remainingMs > 0
    ? { throttled: true, remainingMs }
    : { throttled: false, remainingMs: 0 };
};

// Robust to FlashNet's unknown `success`/`ok` shape: key off the currency
// arrays + explicit error fields rather than trusting `success` alone.
export const classifyReindexResponse = response => {
  if (
    !response ||
    response.error ||
    response.errorCode ||
    response.errorMessage
  )
    return 'error';
  if (
    Array.isArray(response.triggeredCurrencies) &&
    response.triggeredCurrencies.length
  )
    return 'funds';
  if (response.checkedCurrencies) return 'no_funds';
  return 'error'; // unknown shape → treat as error, don't burn the window
};
