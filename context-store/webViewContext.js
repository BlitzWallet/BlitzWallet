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
import { getSharedSecret, getPublicKey, utils } from '@noble/secp256k1';
import { createCipheriv, createDecipheriv } from 'react-native-quick-crypto';
import sha256Hash from '../app/functions/hash';

export const INCOMING_SPARK_TX_NAME = 'RECEIVED_CONTACTS EVENT';
export const incomingSparkTransaction = new EventEmitter();
let handshakeComplete = false;
let globalSendWebViewRequest = null;

const WebViewContext = createContext(null);

// Derive AES-256 key via HKDF-SHA256 from sharedX (32 bytes)
function deriveAesKeyFromSharedX(sharedX) {
  // sharedX should be Uint8Array or Buffer
  const ikm =
    sharedX instanceof Uint8Array ? sharedX : Uint8Array.from(sharedX);
  // no salt, info = 'ecdh-aes-key'
  const keyBytes = hkdf(
    sha256,
    ikm,
    new Uint8Array(0),
    new TextEncoder().encode('ecdh-aes-key'),
    32,
  );
  return Buffer.from(keyBytes); // Buffer of length 32
}

const setHandshakeComplete = value => {
  handshakeComplete = value;
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

export const getHandshakeComplete = () => handshakeComplete;

export const WebViewProvider = ({ children }) => {
  const webViewRef = useRef(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const pendingRequests = useRef({});
  const sessionKeyRef = useRef(null);
  const backendPubkey = useRef(null);
  const aesKeyRef = useRef(null);

  const encryptMessage = useCallback((privkey, pubkey, plaintext) => {
    try {
      if (!aesKeyRef.current) throw new Error('AES key not initialized');
      const iv = Buffer.from(randomBytes(12));
      const cipher = createCipheriv('aes-256-gcm', aesKeyRef.current, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag().toString('base64'); // Get 16-byte auth tag
      return `${encrypted}?iv=${iv.toString('base64')}&tag=${authTag}`;
    } catch (err) {
      console.log('error encripting message', err);
    }
  }, []);

  const decryptMessage = useCallback((privkey, pubkey, encryptedText) => {
    try {
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
    } catch (err) {
      console.log('error decrypting message', err);
    }
  }, []);

  const handleWebViewResponse = useCallback(event => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'handshake:reply' && message.pubW) {
        backendPubkey.current = Buffer.from(message.pubW, 'hex');
        const shared = getSharedSecret(
          sessionKeyRef.current.privateKey,
          backendPubkey.current,
          true,
        );
        const sharedX = shared.slice(1, 33);
        aesKeyRef.current = deriveAesKeyFromSharedX(sharedX);
        console.log('Handshake complete. Got backend public key.');
        setHandshakeComplete(true);
        return;
      }

      let content = message;

      if (message.encrypted && sessionKeyRef.current) {
        const decrypted = decryptMessage(
          sessionKeyRef.current.privateKey,
          backendPubkey.current,
          message.encrypted,
        );

        try {
          content = JSON.parse(decrypted);
        } catch (err) {
          content = decrypted;
        }
      }
      console.log('receiving message from webview', content);

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
          resolve(JSON.parse(content.result || null));
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
        if (!webViewRef.current || !isWebViewReady)
          return reject(new Error('WebView not ready'));

        const id = customUUID();
        pendingRequests.current[id] = resolve;

        if (args.mnemonic && action !== 'initializeSparkWallet') {
          args.mnemonic = sha256Hash(args.mnemonic);
        }

        let payload = { id, action, args };
        console.log('sending message to webview', action, payload);
        if (encrypt && sessionKeyRef.current && backendPubkey.current) {
          const encrypted = encryptMessage(
            sessionKeyRef.current.privateKey,
            backendPubkey.current,
            JSON.stringify(payload),
          );
          payload = { type: 'secure:msg', encrypted };
        }
        webViewRef.current.postMessage(JSON.stringify(payload));
      });
    },
    [isWebViewReady],
  );

  const initHandshake = useCallback(() => {
    const privN = randomBytes(32);
    const pubN = getPublicKey(privN, true); // compressed
    const pubNHex = Buffer.from(pubN).toString('hex');

    sessionKeyRef.current = {
      privateKey: Buffer.from(privN).toString('hex'),
      publicKey: Buffer.from(pubN).toString('hex'),
    };

    sendWebViewRequestInternal('handshake:init', { pubN: pubNHex });
  }, [sendWebViewRequestInternal]);

  useEffect(() => {
    if (!webViewRef.current) return;
    if (!isWebViewReady) return;

    // initHandshake();
  }, [isWebViewReady]);

  useEffect(() => {
    globalSendWebViewRequest = sendWebViewRequestInternal;
  }, [sendWebViewRequestInternal]);

  return (
    <WebViewContext.Provider
      value={{ webViewRef, sendWebViewRequest: sendWebViewRequestInternal }}
    >
      {children}
      <WebView
        domStorageEnabled={false}
        allowFileAccess={false}
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
        source={
          Platform.OS === 'ios'
            ? require('spark-web-context')
            : { uri: 'file:///android_asset/sparkContext.html' }
        }
        originWhitelist={['*']}
        onMessage={handleWebViewResponse}
        onLoadEnd={() => setIsWebViewReady(true)}
        onContentProcessDidTerminate={() => {
          console.warn('WebView content process terminated — reloading...');
          setIsWebViewReady(false);
          setHandshakeComplete(false);
          sessionKeyRef.current = null;
          backendPubkey.current = null;
          aesKeyRef.current = null;
          webViewRef.current?.reload();
        }}
      />
    </WebViewContext.Provider>
  );
};

export const useWebView = () => React.useContext(WebViewContext);
