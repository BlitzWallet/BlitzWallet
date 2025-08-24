import fetchBackend from '../../db/handleBackend';

export default async function getFiatPrice(
  selectedCurrency,
  privateKey,
  publicKey,
) {
  try {
    const response = await fetchBackend(
      'bitcoinPriceData',
      {
        currencyCode: selectedCurrency,
      },
      privateKey,
      publicKey,
    );

    if (!response) throw new Error('Backend Error');

    return response;
  } catch (err) {
    console.log('error getting fiat price', err);
    return false;
  }
}
