import {SATSPERBITCOIN} from '../../constants';
import {crashlyticsLogReport} from '../crashlyticsLogs';

export default function formatBip21LiquidAddress({
  address = '',
  amount = 0,
  message = '',
  assetID = '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d',
}) {
  try {
    crashlyticsLogReport('Formatting bip21 liquid address');
    const liquidBip21 = `liquidnetwork:${address}?assetid=${assetID}&amount=${(
      amount / SATSPERBITCOIN
    ).toFixed(8)}${message ? `&message=${message}` : ''}`;
    return liquidBip21;
  } catch (err) {
    console.log('format bip21 liquid address error', err);
    return '';
  }
}
