import { StyleSheet } from 'react-native';
import GlobalThemeView from './globalThemeView';
import { WebView } from 'react-native-webview';
import { CENTER } from '../../constants';
import { SIZES, WINDOWWIDTH } from '../../constants/theme';
import { useRef } from 'react';
import CustomSettingsTopBar from './settingsTopBar';

const ALLOWED_SCHEMES = new Set(['https:', 'http:']);

function getAllowedOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export default function CustomWebView(props) {
  const webViewRef = useRef(null);
  const isHTML = !!props.route.params?.isHTML;
  const initialURL = props.route.params?.webViewURL;
  const allowedOrigin = getAllowedOrigin(initialURL);

  const htmlSource = isHTML
    ? `
      <!DOCTYPE html>
      <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Document</title>
            <style>
              * { font-size: 20px !important; }
            </style>
        </head>
        <body style="margin-bottom: 60px">
          <div style="width: 90%; margin: 0 auto">
            ${initialURL}
          </div>
        </body>
      </html>`
    : null;

  const shouldStartLoadWithRequest = request => {
    if (isHTML) {
      // Static HTML content is not a browser; block all navigation.
      return false;
    }
    try {
      const url = new URL(request.url);
      if (!ALLOWED_SCHEMES.has(url.protocol)) {
        return false;
      }
      if (allowedOrigin && url.origin === allowedOrigin) {
        return true;
      }
      return request.url === initialURL;
    } catch {
      return false;
    }
  };

  const originWhitelist = isHTML || !allowedOrigin ? null : [allowedOrigin];

  return (
    <GlobalThemeView styles={{ paddingBottom: 0 }}>
      <CustomSettingsTopBar
        containerStyles={styles.topBar}
        label={props.route.params?.headerText}
      />
      <WebView
        style={styles.container}
        source={isHTML ? { html: htmlSource } : { uri: initialURL }}
        javaScriptEnabled={!isHTML}
        onShouldStartLoadWithRequest={shouldStartLoadWithRequest}
        originWhitelist={originWhitelist}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        geolocationEnabled={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        mediaPlaybackRequiresUserAction={true}
        allowsInlineMediaPlayback={false}
        ref={webViewRef}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    fontSize: SIZES.medium,
  },
  topBar: {
    width: WINDOWWIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    ...CENTER,
  },
});
