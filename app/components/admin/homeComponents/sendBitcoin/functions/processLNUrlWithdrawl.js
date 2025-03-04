import {withdrawLnurl} from '@breeztech/react-native-breez-sdk';
import {lnurlWithdraw} from '@breeztech/react-native-breez-sdk-liquid';

export default async function processLNUrlWithdraw(input, context) {
  const {
    nodeInformation,
    masterInfoObject,
    navigate,
    goBackFunction,
    setLoadingMessage,
  } = context;
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
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Error comnpleting withdrawl',
        customNavigator: () => goBackFunction(),
      });
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
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Error comnpleting withdrawl',
        customNavigator: () => goBackFunction(),
      });
    }
  }
}
