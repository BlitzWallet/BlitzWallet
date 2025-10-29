import { SPARK_CACHED_BALANCE_KEY } from '../../constants';
import { getLocalStorageItem } from '../localStorage';

export async function getCachedSparkBalance() {
  const balance = await getLocalStorageItem(SPARK_CACHED_BALANCE_KEY);
  return balance || 0;
}
