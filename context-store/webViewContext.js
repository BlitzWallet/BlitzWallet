import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import WebView from 'react-native-webview';
import customUUID from '../app/functions/customUUID';
import EventEmitter from 'events';
import { sha256 } from '@noble/hashes/sha2';
import { hkdf } from '@noble/hashes/hkdf';
import { randomBytes } from '@noble/hashes/utils';
import { Platform } from 'react-native';
import { getSharedSecret, getPublicKey } from '@noble/secp256k1';
import { createCipheriv, createDecipheriv } from 'react-native-quick-crypto';
import sha256Hash from '../app/functions/hash';
import { verifyAndPrepareWebView } from '../app/functions/webview/bundleVerification';
import DeviceInfo from 'react-native-device-info';
import { getLocalStorageItem, setLocalStorageItem } from '../app/functions';

export const INCOMING_SPARK_TX_NAME = 'RECEIVED_CONTACTS EVENT';
export const incomingSparkTransaction = new EventEmitter();
const WASM_ERRORS = [
  'WebAssembly.Compile is disallowed on the main thread',
  "Cannot read properties of undefined (reading '__wbindgen_malloc')",
];
let handshakeComplete = false;
let forceReactNativeUse = null;
let globalSendWebViewRequest = null;

const WebViewContext = createContext(null);

// Derive AES-256 key via HKDF-SHA256 from sharedX (32 bytes)
function deriveAesKeyFromSharedX(sharedX, randomNonce) {
  // sharedX should be Uint8Array or Buffer
  const ikm =
    sharedX instanceof Uint8Array ? sharedX : Uint8Array.from(sharedX);
  // no salt, info = 'ecdh-aes-key'
  const keyBytes = hkdf(
    sha256,
    ikm,
    new Uint8Array(0),
    new TextEncoder().encode('ecdh-aes-key:' + randomNonce),
    32,
  );
  return Buffer.from(keyBytes); // Buffer of length 32
}

const setHandshakeComplete = value => {
  handshakeComplete = value;
};

export const setForceReactNative = value => {
  forceReactNativeUse = value;
};

export const sendWebViewRequestGlobal = async (
  action,
  args = {},
  encrypt = true,
) => {
  if (!globalSendWebViewRequest) {
    throw new Error(
      'WebView not initialized. Ensure WebViewProvider is mounted.',
    );
  }
  return globalSendWebViewRequest(action, args, encrypt);
};

export const getHandshakeComplete = () => {
  if (forceReactNativeUse !== null) {
    return false;
  }
  return handshakeComplete;
};

export const WebViewProvider = ({ children }) => {
  const webViewRef = useRef(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const pendingRequests = useRef({});
  const sessionKeyRef = useRef(null);
  const aesKeyRef = useRef(null);
  const expectedNonceRef = useRef(null);
  const [verifiedPath, setVerifiedPath] = useState('');
  const [fileHash, setFileHash] = useState('');
  const expectedSequenceRef = useRef(0);
  const nonceVerified = useRef(false);
  const messageRateLimiter = useRef({
    count: 0,
    windowStart: Date.now(),
    maxPerSecond: 10, // Adjust based on your needs
  });

  const encryptMessage = useCallback(plaintext => {
    if (!aesKeyRef.current) throw new Error('AES key not initialized');
    const iv = Buffer.from(randomBytes(12));
    const cipher = createCipheriv('aes-256-gcm', aesKeyRef.current, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64'); // Get 16-byte auth tag
    return `${encrypted}?iv=${iv.toString('base64')}&tag=${authTag}`;
  }, []);

  const decryptMessage = useCallback(encryptedText => {
    if (!aesKeyRef.current) throw new Error('AES key not initialized');
    if (!encryptedText.includes('?iv=') || !encryptedText.includes('&tag=')) {
      throw new Error('Missing IV or auth tag');
    }
    const [ciphertext, params] = encryptedText.split('?iv=');
    const [ivBase64, authTagBase64] = params.split('&tag=');
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', aesKeyRef.current, iv);
    decipher.setAuthTag(authTag); // Set auth tag for verification
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }, []);

  const handleWebViewResponse = useCallback(event => {
    try {
      const now = Date.now();
      const windowDuration = now - messageRateLimiter.current.windowStart;
      if (windowDuration > 1000) {
        // Reset window
        messageRateLimiter.current.count = 0;
        messageRateLimiter.current.windowStart = now;
      }
      messageRateLimiter.current.count++;

      if (
        messageRateLimiter.current.count >
        messageRateLimiter.current.maxPerSecond
      ) {
        console.error(
          `SECURITY: Rate limit exceeded (${messageRateLimiter.current.count} msgs/sec)`,
        );

        setIsWebViewReady(false);
        setHandshakeComplete(false);
        aesKeyRef.current = null;
        sessionKeyRef.current = null;
        nonceVerified.current = false;
        forceReactNativeUse = true; //set to false so that it uses react-native
        return;
      }

      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'handshake:reply' && message.pubW) {
        if (handshakeComplete) {
          console.error(
            'SECURITY: Unexpected handshake reply, already complete',
          );
          return;
        }

        if (!sessionKeyRef.current) {
          console.error(
            'SECURITY: Received handshake reply without active session key',
          );
          return;
        }

        const shared = getSharedSecret(
          Buffer.from(sessionKeyRef.current.privateKey).toString('hex'),
          Buffer.from(message.pubW, 'hex'),
          true,
        );
        const sharedX = shared.slice(1, 33);
        aesKeyRef.current = deriveAesKeyFromSharedX(
          sharedX,
          expectedNonceRef.current,
        );

        shared.fill(0);
        sharedX.fill(0);

        if (sessionKeyRef.current?.privateKey) {
          sessionKeyRef.current.privateKey.fill(0);
        }
        sessionKeyRef.current = null;

        const decodedNonce = decryptMessage(message.runtimeNonce);
        if (expectedNonceRef.current !== decodedNonce) {
          console.log('Invalid runtime nonce, something went wrong');
          return;
        }
        nonceVerified.current = true;
        console.log('Handshake complete. Got backend public key.');
        setHandshakeComplete(true);
        return;
      }

      let content = message;

      if (message.encrypted && aesKeyRef.current) {
        const decrypted = decryptMessage(message.encrypted);

        try {
          content = JSON.parse(decrypted);
        } catch (err) {
          content = decrypted;
        }
      }
      console.log('receiving message from webview', content);

      if (content.type === 'security:csp-violation') {
        console.error('CSP VIOLATION DETECTED:', content);

        // Shut down WebView immediately
        setIsWebViewReady(false);
        setHandshakeComplete(false);
        aesKeyRef.current = null;
        sessionKeyRef.current = null;
        nonceVerified.current = false;
        forceReactNativeUse = true; //set to false so that it uses react-native
        return;
      }

      if (content.error) throw new Error(content.error);

      if (content.incomingPayment) {
        const data = JSON.parse(content.result);
        incomingSparkTransaction.emit(
          INCOMING_SPARK_TX_NAME,
          data.transferId,
          data.balance,
        );
      }
      if (content.isResponse && content.id) {
        const resolve = pendingRequests.current[content.id];
        if (resolve) {
          const result = JSON.parse(content.result || null);
          if (
            result?.error &&
            WASM_ERRORS.some(errMsg => result.error.includes(errMsg))
          ) {
            console.warn(
              'WASM failed, switching to React Native implementation:',
              result.error,
            );

            setIsWebViewReady(false);
            setHandshakeComplete(false);
            aesKeyRef.current = null;
            sessionKeyRef.current = null;
            nonceVerified.current = false;
            forceReactNativeUse = true;
            setLocalStorageItem('FORCE_REACT_NATIVE', 'true');
          }
          resolve(result);

          delete pendingRequests.current[content.id];
        }
      }
    } catch (err) {
      console.error('Error handling WebView message:', err);
    }
  }, []);

  const sendWebViewRequestInternal = useCallback(
    async (action, args = {}, encrypt = true) => {
      return new Promise(async (resolve, reject) => {
        try {
          if (!webViewRef.current || !isWebViewReady)
            return reject(new Error('WebView not ready'));

          const id = customUUID();
          const sequence = expectedSequenceRef.current++;
          const timestamp = Date.now();
          pendingRequests.current[id] = resolve;

          if (args.mnemonic && action !== 'initializeSparkWallet') {
            args.mnemonic = sha256Hash(args.mnemonic);
          }

          if (action === 'initializeSparkWallet') {
            if (!getHandshakeComplete()) {
              throw new Error('Cannot send seed - handshake not verified');
            }
            if (!nonceVerified.current) {
              throw new Error('Cannot send seed - nonce not verified');
            }
          }

          let payload = { id, action, args, sequence, timestamp };
          console.log('sending message to webview', action, payload);
          if (encrypt && aesKeyRef.current) {
            const encrypted = encryptMessage(JSON.stringify(payload));
            payload = { type: 'secure:msg', encrypted };
          }
          webViewRef.current.postMessage(JSON.stringify(payload));
        } catch (err) {
          console.log(
            'Error sending webview request from internal function',
            err,
          );
          reject(err);
        }
      });
    },
    [isWebViewReady, webViewRef, aesKeyRef],
  );

  const initHandshake = useCallback(() => {
    const privN = randomBytes(32);
    const pubN = getPublicKey(privN, true); // compressed
    const pubNHex = Buffer.from(pubN).toString('hex');

    sessionKeyRef.current = {
      privateKey: privN,
      publicKey: Buffer.from(pubN).toString('hex'),
    };

    sendWebViewRequestInternal('handshake:init', { pubN: pubNHex });
  }, [sendWebViewRequestInternal]);

  useEffect(() => {
    async function startHandshake() {
      if (!webViewRef.current) return;
      if (!isWebViewReady) return;
      if (!verifiedPath) return;
      const androidAPI = DeviceInfo.getApiLevelSync();
      if (androidAPI == 33 || androidAPI == 34) {
        console.warn(`Skipping handshake on Android API ${androidAPI}`);
        return;
      }

      const savedVariable = await getLocalStorageItem('FORCE_REACT_NATIVE');

      if (savedVariable === 'true') {
        console.log('FORCE_REACT_NATIVE is set, skipping handshake');
        return;
      }
      initHandshake();
    }
    startHandshake();
  }, [isWebViewReady, verifiedPath]);

  useEffect(() => {
    (async () => {
      try {
        const { htmlPath, nonceHex, hashHex } = await verifyAndPrepareWebView(
          Platform.OS === 'ios'
            ? require('spark-web-context')
            : 'file:///android_asset/sparkContext.html',
        );

        expectedNonceRef.current = nonceHex;
        setFileHash(hashHex);
        setVerifiedPath(htmlPath);
      } catch (err) {
        console.log(
          'WebView bundle verification failed. Using react-native bundle',
          err,
        );
      }
    })();
  }, []);

  useEffect(() => {
    globalSendWebViewRequest = sendWebViewRequestInternal;
  }, [sendWebViewRequestInternal]);

  return (
    <WebViewContext.Provider
      value={{
        webViewRef,
        sendWebViewRequest: sendWebViewRequestInternal,
        fileHash,
      }}
    >
      {children}
      <WebView
        domStorageEnabled={false}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        thirdPartyCookiesEnabled={false}
        incognito={true}
        webviewDebuggingEnabled={false}
        cacheEnabled={false}
        mixedContentMode="never"
        javaScriptEnabled
        ref={webViewRef}
        containerStyle={{ position: 'absolute', top: 1000, left: 1000 }}
        source={{ uri: verifiedPath }}
        originWhitelist={['file://']}
        onShouldStartLoadWithRequest={request => {
          // Only allow your verified local file
          return request.url === verifiedPath;
        }}
        onMessage={handleWebViewResponse}
        onLoadEnd={() => setIsWebViewReady(true)}
        onContentProcessDidTerminate={() => {
          console.warn('WebView content process terminated — reloading...');
          Object.values(pendingRequests.current).forEach(resolve => {
            if (typeof resolve === 'function') {
              resolve(new Error('WebView terminated unexpectedly'));
            }
          });
          setIsWebViewReady(false);
          setHandshakeComplete(false);
          pendingRequests.current = {};
          sessionKeyRef.current = null;
          expectedSequenceRef.current = 0;
          aesKeyRef.current = null;
          webViewRef.current?.reload();
        }}
      />
    </WebViewContext.Provider>
  );
};

export const useWebView = () => React.useContext(WebViewContext);
