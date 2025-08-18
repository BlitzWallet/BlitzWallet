import {
  lnurlAuth,
  LnUrlCallbackStatusVariant,
} from '@breeztech/react-native-breez-sdk-liquid';
import {crashlyticsLogReport} from '../../../../../functions/crashlyticsLogs';

export default async function processLNUrlAuth(input, context) {
  const {goBackFunction, navigate, setLoadingMessage, t} = context;

  crashlyticsLogReport('Hanlding LURL auth');
  setLoadingMessage(
    t('wallet.sendPages.handlingAddressErrors.lnurlAuthStartMeessage'),
  );
  const result = await lnurlAuth(input.data);
  if (result.type === LnUrlCallbackStatusVariant.OK) {
    navigate.navigate('ErrorScreen', {
      errorMessage: t(
        'wallet.sendPages.handlingAddressErrors.lnurlConfirmMessage',
      ),
      customNavigator: () => navigate.popTo('HomeAdmin', {screen: 'home'}),
    });
  } else {
    goBackFunction(
      t('wallet.sendPages.handlingAddressErrors.lnurlFailedAuthMessage'),
    );
  }
}
