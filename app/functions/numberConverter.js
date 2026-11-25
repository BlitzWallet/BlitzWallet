import {SATSPERBITCOIN} from '../constants';
import {isUsableRate} from './money';

export default function numberConverter(num, denomination, toFixed, fiatStats) {
  try {
    if (denomination === 'fiat' && !isUsableRate(fiatStats, fiatStats?.coin))
      return null;
    const converter = Number(num);
    const number =
      denomination === 'fiat'
        ? converter * (fiatStats.value / SATSPERBITCOIN)
        : converter;

    if (typeof number === 'string') throw new Error('Cannot convert');
    return number?.toFixed(toFixed || 0);
  } catch (err) {
    console.log('number converter error', err);
    return Number(0).toFixed(toFixed || 0);
  }
}
