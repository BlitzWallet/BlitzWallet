import { SPARK_CACHED_BALANCE_KEY } from '../../constants';
import sha256Hash from '../hash';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';

export default async function handleBalanceCache({
  isCheck,
  passedBalance,
  mnemonic,
  returnBalanceOnly = false,
}) {
  const mnemonicHash = sha256Hash(mnemonic);

  const cachedBalances = await migrateCachedData(mnemonicHash);

  if (returnBalanceOnly) {
    return cachedBalances[mnemonicHash] || 0;
  }

  if (isCheck) {
    const cachedBalance = cachedBalances[mnemonicHash] || null;

    if (!cachedBalance) {
      cachedBalances[mnemonicHash] = passedBalance;
      await setLocalStorageItem(
        SPARK_CACHED_BALANCE_KEY,
        JSON.stringify(cachedBalances),
      );
      return { didWork: true, balance: passedBalance };
    }
    if (passedBalance == cachedBalance) {
      cachedBalances[mnemonicHash] = passedBalance;
      await setLocalStorageItem(
        SPARK_CACHED_BALANCE_KEY,
        JSON.stringify(cachedBalances),
      );
      return { didWork: true, balance: passedBalance };
    } else {
      return { didWork: false, balance: cachedBalance };
    }
  } else {
    // Set the balance for this mnemonic hash
    cachedBalances[mnemonicHash] = passedBalance;

    await setLocalStorageItem(
      SPARK_CACHED_BALANCE_KEY,
      JSON.stringify(cachedBalances),
    );
  }
}

async function migrateCachedData(mnemonicHash) {
  const rawCachedData = await getLocalStorageItem(SPARK_CACHED_BALANCE_KEY);
  if (!rawCachedData) {
    return {};
  }

  const parsedData = JSON.parse(rawCachedData);

  if (typeof parsedData === 'number') {
    console.log('Migrating old balance cache format to new hash-based format');

    const newFormat = {
      [mnemonicHash]: parsedData,
    };
    await setLocalStorageItem(
      SPARK_CACHED_BALANCE_KEY,
      JSON.stringify(newFormat),
    );
    return newFormat;
  }

  return parsedData;
}
