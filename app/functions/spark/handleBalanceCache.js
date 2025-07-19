import {SPARK_CACHED_BALANCE_KEY} from '../../constants';
import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';

export default async function handleBalanceCache({isCheck, passedBalance}) {
  console.log('HANDLING IN BALANCE CACHE', isCheck, passedBalance);
  if (isCheck) {
    const cachedBalance =
      JSON.parse(await getLocalStorageItem(SPARK_CACHED_BALANCE_KEY)) || null;

    console.log(isCheck, passedBalance, cachedBalance);
    if (!cachedBalance) {
      await setLocalStorageItem(
        SPARK_CACHED_BALANCE_KEY,
        JSON.stringify(passedBalance),
      );
      return {didWork: true, balance: passedBalance};
    }
    if (passedBalance * 1.1 >= cachedBalance) {
      await setLocalStorageItem(
        SPARK_CACHED_BALANCE_KEY,
        JSON.stringify(passedBalance),
      );
      return {didWork: true, balance: passedBalance};
    } else {
      return {didWork: false, balance: cachedBalance};
    }
  } else {
    await setLocalStorageItem(
      SPARK_CACHED_BALANCE_KEY,
      JSON.stringify(passedBalance),
    );
  }
}
