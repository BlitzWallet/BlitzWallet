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
        customNavigator: () => navigate.popTo('HomeAdmin', {screen: 'home'}),
      });
    } else {
      goBackFunction('Failed to authenticate LNURL');
    }
  } catch (err) {
    console.log(err);
    goBackFunction(err.message);
  }
}
