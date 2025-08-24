import {fetchFiatRates} from '@breeztech/react-native-breez-sdk-liquid';
import {setLocalStorageItem} from './localStorage';

export default async function loadNewFiatData(selectedCurrency) {
  try {
    console.log('Loading fiat rates');
    const fiatRates = await fetchFiatRates();
    if (!fiatRates) throw new Error('error loading fiat rates');
    const [fiatRate] = fiatRates.filter(
      rate => rate.coin.toLowerCase() === selectedCurrency.toLowerCase(),
    );

    await Promise.all([
      setLocalStorageItem(
        'didFetchFiatRateToday',
        JSON.stringify({
          lastFetched: new Date().getTime(),
          rates: fiatRates,
        }),
      ),
      setLocalStorageItem('cachedBitcoinPrice', JSON.stringify(fiatRate)),
    ]);

    return {didWork: true, fiatRate, fiatRates};
  } catch (err) {
    console.log('error loading fiat rates', err);
    return {didWork: false, error: err.message};
  }
}
