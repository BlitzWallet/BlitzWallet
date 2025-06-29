import {lnurlWithdraw} from '@breeztech/react-native-breez-sdk-liquid';
import {crashlyticsLogReport} from '../../../../../functions/crashlyticsLogs';

export default async function processLNUrlWithdraw(input, context) {
  const {setLoadingMessage} = context;
  crashlyticsLogReport('Begining LNURL withdrawl process');
  setLoadingMessage('Starting LNURL withdrawl');

  const amountMsat = input.data.minWithdrawable;
  await lnurlWithdraw({
    data: input.data,
    amountMsat,
    description: 'Withdrawl',
  });
}
