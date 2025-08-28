import {decode} from 'bip21';
import {crashlyticsLogReport} from './crashlyticsLogs';

export function decodeBip21Address(address, prefix) {
  try {
    crashlyticsLogReport('decoding bip21 spark');
    return decode(address, prefix);
  } catch (err) {
    console.log('format bip21 spark address error', err);
    return '';
  }
}
