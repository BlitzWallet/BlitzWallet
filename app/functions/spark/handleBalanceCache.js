import {SPARK_CACHED_BALANCE_KEY} from '../../constants';
import sha256Hash from '../hash';
import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';

export default async function handleBalanceCache({
  isCheck,
  passedBalance,
  mnemonic,
}) {
  console.log('HANDLING IN BALANCE CACHE', isCheck, passedBalance);

  const mnemonicHash = sha256Hash(mnemonic);
  async function migrateCachedData() {
    const rawCachedData = await getLocalStorageItem(SPARK_CACHED_BALANCE_KEY);
    if (!rawCachedData) {
      return {};
    }

    const parsedData = JSON.parse(rawCachedData);

    if (typeof parsedData === 'number') {
      console.log(
        'Migrating old balance cache format to new hash-based format',
      );

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

  if (isCheck) {
    const cachedBalances = await migrateCachedData();

    const cachedBalance = cachedBalances[mnemonicHash] || null;

    console.log(isCheck, passedBalance, cachedBalance);
    if (!cachedBalance) {
      cachedBalances[mnemonicHash] = passedBalance;
      await setLocalStorageItem(
        SPARK_CACHED_BALANCE_KEY,
        JSON.stringify(cachedBalances),
      );
      return {didWork: true, balance: passedBalance};
    }
    if (passedBalance * 1.1 >= cachedBalance) {
      cachedBalances[mnemonicHash] = passedBalance;
      await setLocalStorageItem(
        SPARK_CACHED_BALANCE_KEY,
        JSON.stringify(cachedBalances),
      );
      return {didWork: true, balance: passedBalance};
    } else {
      return {didWork: false, balance: cachedBalance};
    }
  } else {
    const cachedBalances = await migrateCachedData();

    // Set the balance for this mnemonic hash
    cachedBalances[mnemonicHash] = passedBalance;

    await setLocalStorageItem(
      SPARK_CACHED_BALANCE_KEY,
      JSON.stringify(cachedBalances),
    );
  }
}
