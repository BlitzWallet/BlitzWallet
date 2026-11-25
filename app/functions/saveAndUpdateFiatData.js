import { getLocalStorageItem, setLocalStorageItem } from './localStorage';
import getFiatPrice from './getFiatPrice';
import { RATE_REFRESH_MS } from './money';

export async function getCachedFiatRate(selectedCurrency) {
  try {
    const cacheKey = `fiatRate_${selectedCurrency.toLowerCase()}`;
    const cached = JSON.parse(await getLocalStorageItem(cacheKey));
    if (
      cached?.fiatRate?.coin?.toLowerCase() === selectedCurrency.toLowerCase()
    ) {
      return cached; // { lastFetched, fiatRate: { coin, value } }
    }
    return null;
  } catch (err) {
    return null;
  }
}

export default async function loadNewFiatData(
  selectedCurrency,
  contactsPrivateKey,
  publicKey,
  masterInfoObject,
) {
  try {
    // Use currency-specific cache key
    const cacheKey = `fiatRate_${selectedCurrency.toLowerCase()}`;
    const cachedResponse = await getCachedFiatRate(selectedCurrency);
    const isMainCurrency =
      selectedCurrency.toLowerCase() ===
      (masterInfoObject.fiatCurrency?.toLowerCase() || 'usd');

    if (
      cachedResponse &&
      Date.now() - cachedResponse.lastFetched < RATE_REFRESH_MS
    ) {
      if (isMainCurrency) await updateMainCurrency(cachedResponse.fiatRate);
      return {
        didWork: true,
        fiatRateResponse: cachedResponse.fiatRate,
        usingCache: true,
        fetchedAt: cachedResponse.lastFetched,
      };
    }

    let fiatRateResponse = false;
    for (let attempt = 0; attempt < 3 && !fiatRateResponse; attempt++) {
      if (attempt > 0) await new Promise(res => setTimeout(res, 1000));
      fiatRateResponse = await getFiatPrice(
        selectedCurrency,
        contactsPrivateKey,
        publicKey,
      );
    }

    if (!fiatRateResponse) throw new Error('error loading fiat rates');

    const fetchedAt = new Date().getTime();
    await setLocalStorageItem(
      cacheKey,
      JSON.stringify({
        lastFetched: fetchedAt,
        fiatRate: fiatRateResponse,
      }),
    );

    if (isMainCurrency) {
      await updateMainCurrency(fiatRateResponse);
    }

    return { didWork: true, fiatRateResponse, usingCache: false, fetchedAt };
  } catch (err) {
    console.log('error loading fiat rates', err);
    return { didWork: false, error: err.message, usingCache: false };
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
