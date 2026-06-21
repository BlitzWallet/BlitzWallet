import { crashlyticsLogReport } from '../../../../../functions/crashlyticsLogs';
import { lnurlAuth } from '../../../../../functions/lnurl/lnurlAuth';

export default async function processLNUrlAuth(input, context) {
  const { navigate, setLoadingMessage, t, accountMnemoinc } = context;

  crashlyticsLogReport('Handling LNURL auth');
  setLoadingMessage(
    t('wallet.sendPages.handlingAddressErrors.lnurlAuthStartMeessage'),
  );

  try {
    await lnurlAuth({
      k1: input.data.k1,
      callback: input.data.callback,
      mnemonic: accountMnemoinc,
    });
  } catch (err) {
    console.log('LNURL auth error', err);
    throw new Error(
      err.isServiceRejection
        ? t('wallet.sendPages.handlingAddressErrors.lnurlFailedAuthMessage')
        : t('errormessages.tryAgain'),
    );
  }

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
}
