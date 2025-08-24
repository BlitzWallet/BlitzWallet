import {getLocalStorageItem, setLocalStorageItem} from './localStorage';
import getFiatPrice from './getFiatPrice';
import {isMoreThan40MinOld} from './rotateAddressDateChecker';

export default async function loadNewFiatData(
  selectedCurrency,
  contactsPrivateKey,
  publicKey,
  shouldSave = true,
) {
  try {
    const cachedResponse = JSON.parse(
      await getLocalStorageItem('didFetchFiatRateToday'),
    );
    // removing fetch to backend if working under cache
    if (
      shouldSave &&
      cachedResponse &&
      cachedResponse.fiatRate?.coin?.toLowerCase() ===
        selectedCurrency.toLowerCase() &&
      !isMoreThan40MinOld(cachedResponse.lastFetched)
    ) {
      return {didWork: true, fiatRateResponse: cachedResponse.fiatRate};
    }

    const fiatRateResponse = await getFiatPrice(
      selectedCurrency,
      contactsPrivateKey,
      publicKey,
    );

    if (!fiatRateResponse) throw new Error('error loading fiat rates');

    if (shouldSave) {
      await Promise.all([
        setLocalStorageItem(
          'didFetchFiatRateToday',
          JSON.stringify({
            lastFetched: new Date().getTime(),
            fiatRate: fiatRateResponse,
          }),
        ),
        setLocalStorageItem(
          'cachedBitcoinPrice',
          JSON.stringify(fiatRateResponse),
        ),
      ]);
    }

    return {didWork: true, fiatRateResponse};
  } catch (err) {
    console.log('error loading fiat rates', err);
    return {didWork: false, error: err.message};
  }
}
