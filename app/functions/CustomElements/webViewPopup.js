import {StyleSheet, TouchableOpacity, View} from 'react-native';
import GlobalThemeView from './globalThemeView';
import {WebView} from 'react-native-webview';
import {CENTER, ICONS} from '../../constants';
import ThemeImage from './themeImage';
import {SIZES, WINDOWWIDTH} from '../../constants/theme';
import ThemeText from './textTheme';
import {useRef} from 'react';

export default function CustomWebView(props) {
  // CSS to inject into the WebView
  const webViewRef = useRef(null);
  const injectedJavaScript = `(function () {
    console.log('IS RUNNING');
    // Set base font size
    
      // Change font size for all elements
      console.log('IS RUNNING');
      document.querySelectorAll('*').forEach(element => {
        element.style.fontSize = '20px';
      });
    
  })();
  true;
  `;

  let webViewContent = props.route.params?.webViewURL;

  if (props.route.params?.isHTML) {
    webViewContent = `<!DOCTYPE html>
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
  return (
    <GlobalThemeView styles={{paddingBottom: 0}}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            props.navigation.goBack();
          }}
          style={{marginRight: 'auto'}}>
          <ThemeImage
            lightModeIcon={ICONS.smallArrowLeft}
            darkModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>
        <ThemeText
          styles={styles.textStyles}
          content={props.route.params?.headerText}
        />
      </View>
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
  textStyles: {
    width: '100%',
    zIndex: -1,
    position: 'absolute',
    textAlign: 'center',
    fontSize: SIZES.xLarge,
  },
});
