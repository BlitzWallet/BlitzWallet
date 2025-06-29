import * as bip21 from 'bip21';
import {crashlyticsLogReport} from './crashlyticsLogs';
export function formatBip21Address({
  address = '',
  amount = 0,
  message = '',
  prefix = '',
}) {
  try {
    crashlyticsLogReport('Formatting bip21 liquid address');
    return bip21.encode(
      address,
      {
        amount: amount,
        label: message,
        message: message,
      },
      prefix,
    );
  } catch (err) {
    console.log('format bip21 spark address error', err);
    return '';
  }
}
export function decodeBip21Address(address, prefix) {
  try {
    crashlyticsLogReport('decoding bip21 spark');
    return bip21.decode(address, prefix);
  } catch (err) {
    console.log('format bip21 spark address error', err);
    return '';
  }
}
