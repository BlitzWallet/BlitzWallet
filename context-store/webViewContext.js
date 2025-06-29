import React, {createContext, use, useEffect, useRef, useState} from 'react';
import WebView from 'react-native-webview';
import {Platform} from 'react-native';
import {getLocalStorageItem, setLocalStorageItem} from '../app/functions';
import handleWebviewClaimMessage from '../app/functions/boltz/handle-webview-claim-message';

// Create a context for the WebView ref
const WebViewContext = createContext(null);

export const WebViewProvider = ({children}) => {
  const webViewRef = useRef(null);
  const [isWEbViewReady, setIsWebViewReady] = useState(false);
  const handleClaimRetryRef = useRef(null);
  const startClaimRetryRef = useRef(null);
  // const [webViewArgs, setWebViewArgs] = useState({
  //   navigate: null,
  //   page: null,
  //   function: null,
  // });

  useEffect(() => {
    if (!isWEbViewReady) return;
    if (startClaimRetryRef.current) return;
    startClaimRetryRef.current = true;

    async function handleUnclaimedReverseSwaps() {
      console.log('Checking for unclaimed reverse swaps');
      let savedClaimInfo =
        JSON.parse(await getLocalStorageItem('savedReverseSwapInfo')) || [];

      console.log('Saved claim info length:', savedClaimInfo.length);
      console.log('Saved claim info:', savedClaimInfo);
      if (savedClaimInfo.length === 0) return;
      let newClaims = [];
      for (const claim in savedClaimInfo) {
        const createdOn = new Date(claim.createdOn);
        const now = new Date();
        if (!claim?.swapInfo?.id) continue;
        if (claim.numberOfTries > 15) continue;
        if (createdOn - now < 1000 * 60 * 3) {
          // If the claim is less than 3 minutes old, skip it to prevent race condition with the websocket
          newClaims.push(claim);
          continue;
        }

        newClaims.push({...claim, numberOfTries: claim.numberOfTries + 1});

        console.log('Processing claim:', claim);
        const claimInfo = JSON.stringify(claim);
        webViewRef.current.injectJavaScript(
          `window.claimReverseSubmarineSwap(${claimInfo}); void(0);`,
        );
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      setLocalStorageItem('savedReverseSwapInfo', JSON.stringify(newClaims));
    }

    if (handleClaimRetryRef.current) {
      console.log(
        'Clearing previous claim retry interval',
        handleClaimRetryRef.current,
      );
      clearInterval(handleClaimRetryRef.current);
    }

    console.log('Setting up claim retry interval');
    handleClaimRetryRef.current = setInterval(
      handleUnclaimedReverseSwaps,
      30000,
    );
  }, [isWEbViewReady]);

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
        onLoadEnd={() => setIsWebViewReady(true)}
      />
    </WebViewContext.Provider>
  );
};

export const useWebView = () => {
  return React.useContext(WebViewContext);
};
