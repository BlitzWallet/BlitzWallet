import {SPARK_CACHED_BALANCE_KEY} from '../../constants';
import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';

export default async function handleBalanceCache({isCheck, passedBalance}) {
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
    if (passedBalance >= cachedBalance) {
      return {didWork: true, balance: passedBalance};
    } else {
      return {didWork: false};
    }
  } else {
    await setLocalStorageItem(
      SPARK_CACHED_BALANCE_KEY,
      JSON.stringify(passedBalance),
    );
  }
}
