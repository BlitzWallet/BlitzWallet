import * as WebBrowser from 'expo-web-browser';

export default async function openWebBrowser({ navigate, link }) {
  try {
    await WebBrowser.openBrowserAsync(link);
  } catch (err) {
    if (navigate) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Cannot open web broswer',
      });
    }
    console.log(err, 'OPENING LINK ERROR');
  }
}
