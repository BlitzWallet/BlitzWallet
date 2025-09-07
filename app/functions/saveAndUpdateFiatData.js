import {getLocalStorageItem, setLocalStorageItem} from './localStorage';
import getFiatPrice from './getFiatPrice';
import {isMoreThan40MinOld} from './rotateAddressDateChecker';

export default async function loadNewFiatData(
  selectedCurrency,
  contactsPrivateKey,
  publicKey,
  masterInfoObject,
) {
  try {
    // Use currency-specific cache key
    const cacheKey = `fiatRate_${selectedCurrency.toLowerCase()}`;
    const cachedResponse = JSON.parse(await getLocalStorageItem(cacheKey));
    const isMainCurrency =
      selectedCurrency.toLowerCase() ===
      (masterInfoObject.fiatCurrency?.toLowerCase() || 'usd');

    if (
      cachedResponse &&
      cachedResponse.fiatRate?.coin?.toLowerCase() ===
        selectedCurrency.toLowerCase() &&
      !isMoreThan40MinOld(cachedResponse.lastFetched)
    ) {
      if (isMainCurrency) await updateMainCurrency(cachedResponse.fiatRate);
      return {didWork: true, fiatRateResponse: cachedResponse.fiatRate};
    }

    const fiatRateResponse = await getFiatPrice(
      selectedCurrency,
      contactsPrivateKey,
      publicKey,
    );

    if (!fiatRateResponse) throw new Error('error loading fiat rates');

    await setLocalStorageItem(
      cacheKey,
      JSON.stringify({
        lastFetched: new Date().getTime(),
        fiatRate: fiatRateResponse,
      }),
    );

    if (isMainCurrency) {
      await updateMainCurrency(fiatRateResponse);
    }

    return {didWork: true, fiatRateResponse};
  } catch (err) {
    console.log('error loading fiat rates', err);
    return {didWork: false, error: err.message};
  }
}

async function updateMainCurrency(fiatRateResponse) {
  await Promise.all([
    setLocalStorageItem(
      'didFetchFiatRateToday',
      JSON.stringify({
        lastFetched: new Date().getTime(),
        fiatRate: fiatRateResponse,
      }),
    ),
    setLocalStorageItem('cachedBitcoinPrice', JSON.stringify(fiatRateResponse)),
  ]);
}
