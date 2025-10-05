import sha256Hash from '../hash';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';

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

export const migrateCachedTokens = async mnemonic => {
  const mnemonicHash = sha256Hash(mnemonic);
  let parsedData = await getCachedTokens();

  const isOldFormat =
    !parsedData[mnemonicHash] &&
    Object.keys(parsedData).some(key => key.startsWith('btkn'));

  if (isOldFormat) {
    console.log('Migrating old token cache format to mnemonic-hash format');

    const migratedTokens = {};
    for (const [key, value] of Object.entries(parsedData)) {
      if (key.startsWith('btkn')) {
        migratedTokens[key] = value;
        delete parsedData[key];
      }
    }

    parsedData[mnemonicHash] = migratedTokens;

    await setLocalStorageItem(TOKEN_CACHE_KEY, JSON.stringify(parsedData));
  }

  return parsedData;
};

export const mergeTokensWithCache = (currentTokens, cachedTokens, mnemonic) => {
  const hashedMnemoinc = sha256Hash(mnemonic);
  let merged = {};
  const selctedCashedTokens = cachedTokens[hashedMnemoinc]
    ? cachedTokens[hashedMnemoinc]
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

  return { ...cachedTokens, [hashedMnemoinc]: merged };
};
