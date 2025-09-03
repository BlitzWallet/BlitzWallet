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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        navigate.reset({
          index: 0, // The top-level route index
          routes: [
            {
              name: 'HomeAdmin', // Navigate to HomeAdmin
              params: {
                screen: 'Home',
              },
            },
            {
              name: 'ConfirmTxPage',
              params: {
                useLNURLAuth: true,
              },
            },
          ],
        });
      });
    });
  } else {
    goBackFunction(
      t('wallet.sendPages.handlingAddressErrors.lnurlFailedAuthMessage'),
    );
  }
}
