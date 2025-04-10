import {withdrawLnurl} from '@breeztech/react-native-breez-sdk';
import {lnurlWithdraw} from '@breeztech/react-native-breez-sdk-liquid';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../../../functions/crashlyticsLogs';

export default async function processLNUrlWithdraw(input, context) {
  const {
    nodeInformation,
    masterInfoObject,
    navigate,
    goBackFunction,
    setLoadingMessage,
  } = context;
  crashlyticsLogReport('Begining LNURL withdrawl process');
  setLoadingMessage('Starting LNURL withdrawl');
  if (
    nodeInformation.userBalance != 0 &&
    nodeInformation.inboundLiquidityMsat / 1000 >
      input.data.maxWithdrawable / 1000 + 100
  ) {
    try {
      await withdrawLnurl({
        data: input.data,
        amountMsat: input.data.maxWithdrawable,
        description: input.data.defaultDescription,
      });
    } catch (err) {
      console.log(err);
      crashlyticsRecordErrorReport(err.message);
      goBackFunction(err.message);
    }
  } else if (masterInfoObject.liquidWalletSettings.regulatedChannelOpenSize) {
    try {
      const amountMsat = input.data.minWithdrawable;
      await lnurlWithdraw({
        data: input.data,
        amountMsat,
        description: 'Withdrawl',
      });
    } catch (err) {
      console.log('process lnurl withdrawls error', err);
      crashlyticsRecordErrorReport(err.message);
      goBackFunction(err.message);
    }
  }
}
