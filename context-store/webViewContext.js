import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import WebView from 'react-native-webview';
import { Platform } from 'react-native';
import customUUID from '../app/functions/customUUID';

// WebView context
const WebViewContext = createContext(null);

export const WebViewProvider = ({ children }) => {
  const webViewRef = useRef(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);

  // Store pending requests: { id: resolveFunction }
  const pendingRequests = useRef({});

  // Handle messages from WebView
  const handleWebViewResponse = useCallback(event => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.isResponse && message.id) {
        const resolve = pendingRequests.current[message.id];
        if (resolve) {
          console.log(
            'receiving message from webview',
            JSON.parse(message.result || null),
          );
          resolve(JSON.parse(message.result || null));
          delete pendingRequests.current[message.id];
        }
      }
    } catch (err) {
      console.error('Error handling WebView message:', err);
    }
  }, []);

  // Function to send a request to the WebView and return a promise
  const sendWebViewRequest = useCallback(
    (action, args = {}) => {
      return new Promise((resolve, reject) => {
        if (!webViewRef.current || !isWebViewReady) {
          return reject(new Error('WebView not ready'));
        }

        const id = customUUID(); // generate unique ID for this request
        pendingRequests.current[id] = resolve;

        const message = {
          id,
          action,
          args,
        };

        console.log('Sending message to webview', message);

        webViewRef.current.postMessage(JSON.stringify(message));
      });
    },
    [isWebViewReady],
  );

  return (
    <WebViewContext.Provider value={{ webViewRef, sendWebViewRequest }}>
      {children}
      <WebView
        domStorageEnabled
        javaScriptEnabled
        ref={webViewRef}
        containerStyle={{ position: 'absolute', top: 1000, left: 1000 }}
        source={
          {
            uri: 'http://192.168.68.54:8081/assets/node_modules/spark-web-context/dist/index.html',
          }
          //   Platform.OS === 'ios'
          //     ? require('spark-web-context/dist/index.html')
          //     : { uri: 'file:///android_asset/sparkWebview.html' }
        }
        originWhitelist={['*']}
        onMessage={handleWebViewResponse}
        onLoadEnd={() => setIsWebViewReady(true)}
      />
    </WebViewContext.Provider>
  );
};

// Hook to use the WebView API
export const useWebView = () => React.useContext(WebViewContext);
