import sha256Hash from '../hash';
import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';

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

export const mergeTokensWithCache = (currentTokens, cachedTokens, mnemonic) => {
  let merged = {};
  const selctedCashedTokens = cachedTokens[sha256Hash(mnemonic)]
    ? cachedTokens[sha256Hash(mnemonic)]
    : {};

  // Update with current token data
  for (const [identifier, tokenData] of Object.entries(selctedCashedTokens)) {
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

  return {...cachedTokens, [sha256Hash(mnemonic)]: merged};
};
