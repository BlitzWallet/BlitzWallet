import {
  lnurlAuth,
  LnUrlCallbackStatusVariant,
} from '@breeztech/react-native-breez-sdk-liquid';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../../../functions/crashlyticsLogs';

export default async function processLNUrlAuth(input, context) {
  const {goBackFunction, navigate, setLoadingMessage} = context;
  try {
    crashlyticsLogReport('Hanlding LURL auth');
    setLoadingMessage('Starting LNURL auth');
    const result = await lnurlAuth(input.data);
    if (result.type === LnUrlCallbackStatusVariant.OK) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'LNURL successfully authenticated',
        customNavigator: () => navigate.popTo('HomeAdmin', {screen: 'home'}),
      });
    } else {
      goBackFunction('Failed to authenticate LNURL');
    }
  } catch (err) {
    console.log(err);
    crashlyticsRecordErrorReport(err.message);
    goBackFunction(err.message);
  }
}
