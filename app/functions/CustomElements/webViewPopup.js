import {StyleSheet} from 'react-native';
import GlobalThemeView from './globalThemeView';
import {WebView} from 'react-native-webview';
import {CENTER} from '../../constants';
import {SIZES, WINDOWWIDTH} from '../../constants/theme';
import {useRef} from 'react';
import CustomSettingsTopBar from './settingsTopBar';

export default function CustomWebView(props) {
  // CSS to inject into the WebView
  const webViewRef = useRef(null);
  let webViewContent = props.route.params?.webViewURL;

  if (props.route.params?.isHTML) {
    webViewContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Document</title>
        </head>
        <body style="margin-bottom: 60px">
          <div style="width: 90%; margin: 0 auto">
            ${webViewContent}
          </div>
        </body>
      </html>`;
  }

  const injectedJavaScript = `
      (function () {   
          document.querySelectorAll('*').forEach(element => {
            element.style.fontSize = '20px';
          });
      })();
      true;
`;

  return (
    <GlobalThemeView styles={{paddingBottom: 0}}>
      <CustomSettingsTopBar
        containerStyles={styles.topBar}
        label={props.route.params?.headerText}
      />
      <WebView
        style={styles.container}
        source={{
          [props.route.params?.isHTML ? 'html' : 'uri']: webViewContent,
        }}
        javaScriptEnabled={true}
        onLoadEnd={() => {
          if (props.route.params?.isHTML)
            webViewRef.current?.injectJavaScript(injectedJavaScript);
        }}
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
