import {
  lnurlAuth,
  LnUrlCallbackStatusVariant,
} from '@breeztech/react-native-breez-sdk-liquid';

export default async function processLNUrlAuth(input, context) {
  const {goBackFunction, navigate, setLoadingMessage} = context;
  try {
    setLoadingMessage('Starting LNURL auth');
    const result = await lnurlAuth(input.data);
    if (result.type === LnUrlCallbackStatusVariant.OK) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'LNURL successfully authenticated',
        customNavigator: () => goBackFunction(),
      });
    } else {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Failed to authenticate LNURL',
        customNavigator: () => goBackFunction(),
      });
    }
  } catch (err) {
    console.log(err);
    navigate.navigate('ErrorScreen', {
      errorMessage: 'Failed to authenticate LNURL',
      customNavigator: () => goBackFunction(),
    });
  }
}
