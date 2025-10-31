import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';

export default async function getFeeRates() {
  const apis = [
    {
      name: 'Mempool.space',
      url: 'https://mempool.space/api/v1/fees/recommended',
    },
    {
      name: 'Blockstream',
      url: 'https://blockstream.info/api/fee-estimates',
    },
  ];

  for (const api of apis) {
    try {
      const response = await fetch(api.url);
      const data = await response.json();
      console.log('fee rates api response', data);

      const feeRates = normalizeFeeRates(data, api.name);

      if (!feeRates) {
        throw new Error(`Invalid response from ${api.name} API`);
      }

      await setLocalStorageItem(
        'cachedFeeRates',
        JSON.stringify({
          rates: feeRates,
          timestamp: Date.now(),
        }),
      );

      return feeRates;
    } catch (err) {
      console.log(
        `fetching fee rates from ${api.name.toLowerCase()} failed`,
        err,
      );

      if (api === apis[apis.length - 1]) {
        console.log('All APIs failed, attempting to use cached data');
        const cachedData = await getCachedFeeRates();
        if (cachedData) {
          console.log('Returning cached fee rates');
          return cachedData;
        }
        return {
          fastest: 10,
          halfHour: 5,
          hour: 3,
          economy: 2,
          minimum: 2,
        };
      }
    }
  }
}

function normalizeFeeRates(data, apiName) {
  try {
    if (apiName === 'Mempool.space' || apiName === 'fbFeeEstimates') {
      return {
        fastest: data.fastestFee || data.fastest,
        halfHour: data.halfHourFee || data.halfHour,
        hour: data.hourFee || data.hour,
        economy: data.economyFee || data.economy,
        minimum: data.minimumFee || data.minimum || 1,
      };
    } else if (apiName === 'Blockstream') {
      return {
        fastest: Math.ceil(data['1'] || data['2'] || 0),
        halfHour: Math.ceil(data['3'] || data['4'] || 0),
        hour: Math.ceil(data['6'] || data['8'] || 0),
        economy: Math.ceil(data['144'] || data['504'] || 0),
        minimum: 1,
      };
    }
    return null;
  } catch (err) {
    console.error('Error normalizing fee rates:', err);
    return null;
  }
}

async function getCachedFeeRates() {
  try {
    const cached = JSON.parse(await getLocalStorageItem('cachedFeeRates'));
    if (!cached) return null;

    // Check if cache is less than 5 minutes old
    const fiveMinutes = 5 * 60 * 1000;
    const isFresh = Date.now() - cached.timestamp < fiveMinutes;

    if (isFresh) {
      return cached.rates;
    }

    // Cache is stale but better than nothing
    console.log('Using stale cached fee rates');
    return cached.rates;
  } catch (err) {
    console.error('Error retrieving cached fee rates:', err);
    return null;
  }
}
