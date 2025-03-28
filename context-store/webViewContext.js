import React, {createContext, useEffect, useRef, useState} from 'react';
import WebView from 'react-native-webview';
import {AppState, Platform} from 'react-native';
import handleWebviewClaimMessage from '../app/functions/boltz/handle-webview-claim-message';
import {getLocalStorageItem, setLocalStorageItem} from '../app/functions';
import {isMoreThanADayOld} from '../app/functions/rotateAddressDateChecker';
import {useAppStatus} from './appStatus';

// Create a context for the WebView ref
const WebViewContext = createContext(null);

export const WebViewProvider = ({children}) => {
  const {didGetToHomepage} = useAppStatus();
  const webViewRef = useRef(null);
  // const [webViewArgs, setWebViewArgs] = useState({
  //   navigate: null,
  //   page: null,
  //   function: null,
  // });

  useEffect(() => {
    if (!didGetToHomepage) {
      return;
    }
    async function handleUnclaimedReverseSwaps() {
      let savedClaimInfo =
        JSON.parse(await getLocalStorageItem('savedReverseSwapInfo')) || [];
      console.log(savedClaimInfo, 'SAVD CLAIM INFORMATION');
      if (savedClaimInfo.length === 0) return;

      try {
        savedClaimInfo.forEach(claim => {
          const claimInfo = JSON.stringify(claim);
          webViewRef.current.injectJavaScript(
            `window.claimReverseSubmarineSwap(${claimInfo}); void(0);`,
          );
        });

        setLocalStorageItem(
          'savedReverseSwapInfo',
          JSON.stringify(
            savedClaimInfo.filter(item => !isMoreThanADayOld(item.createdOn)),
          ),
        );
      } catch (error) {
        console.error('An error occurred:', error);
      }
    }
    handleUnclaimedReverseSwaps();
  }, [didGetToHomepage]);

  return (
    <WebViewContext.Provider
      value={{
        webViewRef,
        // webViewArgs,
        // setWebViewArgs,
      }}>
      {children}
      <WebView
        domStorageEnabled
        javaScriptEnabled
        ref={webViewRef}
        containerStyle={{position: 'absolute', top: 1000, left: 1000}}
        source={
          Platform.OS === 'ios'
            ? require('boltz-swap-web-context')
            : {uri: 'file:///android_asset/boltzSwap.html'}
        }
        originWhitelist={['*']}
        onMessage={event =>
          handleWebviewClaimMessage(
            // webViewArgs.navigate,
            event,
            // webViewArgs.page,
            // webViewArgs.function,
          )
        }
      />
    </WebViewContext.Provider>
  );
};

export const useWebView = () => {
  return React.useContext(WebViewContext);
};
