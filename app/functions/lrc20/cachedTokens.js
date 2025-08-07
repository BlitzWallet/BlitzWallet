import {
  getLocalStorageItem,
  removeLocalStorageItem,
  setLocalStorageItem,
} from '../localStorage';

const TOKEN_CACHE_KEY = 'spark_wallet_tokens_cache';

export const getCachedTokens = async () => {
  try {
    const cached = await getLocalStorageItem(TOKEN_CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch (err) {
    console.warn('Error reading token cache:', err);
    return {};
  }
};

export const saveCachedTokens = async tokens => {
  try {
    await setLocalStorageItem(TOKEN_CACHE_KEY, JSON.stringify(tokens));
  } catch (err) {
    console.warn('Error saving token cache:', err);
  }
};

export const mergeTokensWithCache = (currentTokens, cachedTokens) => {
  let merged = {};

  // Update with current token data
  for (const [identifier, tokenData] of Object.entries(cachedTokens)) {
    merged[identifier] = {
      ...tokenData,
      balance: 0,
    };
  }

  for (const [identifier, tokensData] of currentTokens) {
    merged[identifier] = {
      balance: Number(tokensData.balance),
      tokenMetadata: {
        ...tokensData.tokenMetadata,
        maxSupply: Number(tokensData.tokenMetadata.maxSupply),
      },
    };
  }
  console.log(merged);

  return merged;
};

export const clearTokenCache = async () => {
  try {
    await removeLocalStorageItem(TOKEN_CACHE_KEY);
    return true;
  } catch (err) {
    console.warn('Error clearing token cache:', err);
    return false;
  }
};

export const addTokenMetadata = async (tokenIdentifier, additionalMetadata) => {
  try {
    const cached = await getCachedTokens();
    if (!cached[tokenIdentifier]) {
      cached[tokenIdentifier] = {balance: 0, tokenMetadata: additionalMetadata};
    }

    await saveCachedTokens(cached);
    return true;
  } catch (err) {
    console.warn('Error adding token metadata:', err);
    return false;
  }
};
