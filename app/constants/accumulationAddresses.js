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
