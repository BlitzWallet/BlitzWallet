import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GlobalThemeView from './globalThemeView';
import { WebView } from 'react-native-webview';
import { MAX_WEB_CONTENT_WIDTH } from '../../constants';
import { SIZES } from '../../constants/theme';
import { useRef } from 'react';
import { useTheme } from '../../../context-store/theme';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import openWebBrowser from '../openWebBrowser';
import TopBar from './redesign/TopBar';
import IconButton from './redesign/IconButton';

const ALLOWED_SCHEMES = new Set(['https:', 'http:']);

function getAllowedOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Grey lines shown while the page loads.
const SKELETON = [92, 100, 84, 96, 70, null, 92, 100, 84, 96, 70];

export default function CustomWebView(props) {
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const { bottomPadding } = useGlobalInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const webViewRef = useRef(null);
  const isHTML = !!props.route.params?.isHTML;
  const initialURL = props.route.params?.webViewURL;
  const allowedOrigin = getAllowedOrigin(initialURL);

  // The initial load bypasses shouldStartLoadWithRequest on native and the
  // request filter is inert on web, so refuse non-http(s) embeds here. No
  // current caller passes such a URL; this guards future/scanned input.
  const isInitialUrlAllowed = (() => {
    if (isHTML) return false;
    try {
      return ALLOWED_SCHEMES.has(new URL(initialURL).protocol);
    } catch {
      return false;
    }
  })();

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
    <GlobalThemeView useStandardWidth={true} styles={{ paddingBottom: 0 }}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar
          title={props.route.params?.headerText}
          right={
            isInitialUrlAllowed && (
              <IconButton
                icon="ExternalLink"
                label="constants.openInBrowser"
                iconSize={20}
                onPress={() => openWebBrowser({ navigate, link: initialURL })}
              />
            )
          }
        />
        <View
          style={[
            styles.card,
            { backgroundColor: tokens.surface, marginBottom: bottomPadding },
          ]}
        >
          {isInitialUrlAllowed && (
            <WebView
              style={styles.container}
              startInLoadingState={true}
              renderLoading={() => (
                <View
                  style={[styles.skeleton, { backgroundColor: tokens.surface }]}
                >
                  {SKELETON.map((lineWidth, index) =>
                    lineWidth ? (
                      <View
                        key={index}
                        style={[
                          styles.line,
                          {
                            width: `${lineWidth}%`,
                            backgroundColor: tokens.skel,
                          },
                        ]}
                      />
                    ) : (
                      <View key={index} style={styles.gap} />
                    ),
                  )}
                </View>
              )}
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
          )}
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    fontSize: SIZES.medium,
  },
  content: { flex: 1, alignSelf: 'center' },
  card: { flex: 1, marginTop: 16, borderRadius: 20, overflow: 'hidden' },
  skeleton: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  line: { height: 12, borderRadius: 6, marginTop: 14 },
  gap: { height: 22 },
});
