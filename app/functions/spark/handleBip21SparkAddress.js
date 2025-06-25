import {SATSPERBITCOIN} from '../../constants';
import {crashlyticsLogReport} from '../crashlyticsLogs';
import * as bip21 from 'bip21';
export function formatBip21SparkAddress({
  address = '',
  amount = 0,
  message = '',
}) {
  try {
    console.log(
      bip21.encode(
        address,
        {
          amount: amount,
          message: message,
          label: 'label',
        },
        'spark',
      ),
    );
    crashlyticsLogReport('Formatting bip21 liquid address');
    const liquidBip21 = `spark:${address}?amount=${(
      amount / SATSPERBITCOIN
    ).toFixed(8)}${message ? `&message=${message}` : ''}`;
    return liquidBip21;
  } catch (err) {
    console.log('format bip21 spark address error', err);
    return '';
  }
}
export function decodeBip21SparkAddress(address) {
  try {
    crashlyticsLogReport('decoding bip21 spark');
    return bip21.decode(address, 'spark');
  } catch (err) {
    console.log('format bip21 spark address error', err);
    return '';
  }
}
