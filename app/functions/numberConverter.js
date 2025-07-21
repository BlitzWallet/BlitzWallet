import {SATSPERBITCOIN} from '../constants';

export default function numberConverter(num, denomination, toFixed, fiatStats) {
  try {
    const converter = Number(num);
    const number =
      denomination === 'fiat'
        ? converter * ((fiatStats?.value || 65000) / SATSPERBITCOIN)
        : converter;

    if (typeof number === 'string') throw new Error('Cannot convert');
    return number?.toFixed(toFixed || 0);
  } catch (err) {
    console.log('number converter error', err);
    return Number(0).toFixed(toFixed || 0);
  }
}
