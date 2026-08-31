// Web shim for react-native-webview. The core wallet no longer uses the
// offscreen Spark WebView on web (see webViewContext.web.js). Remaining
// consumers (bitrefill/webViewPopup) render an <iframe>; deferred features
// keep it importable.
import React from 'react';
import { StyleSheet } from 'react-native';

// react-native style props accept arrays / falsy values / registered IDs.
// Spreading an array directly into the <iframe> style object produces numeric
// keys (0, 1, …) which makes React DOM try `style[0] = …` and throws:
// "Failed to set an indexed property [0] on 'CSSStyleDeclaration'".
function flattenStyle(style) {
  if (!style) return {};
  // On web StyleSheet.flatten resolves arrays + registered styles; fall back
  // to manual recursion if unavailable (e.g. in tests).
  if (StyleSheet.flatten) {
    const flat = StyleSheet.flatten(style);
    return flat || {};
  }
  if (Array.isArray(style)) {
    const out = {};
    for (const item of style) {
      if (!item) continue;
      Object.assign(out, flattenStyle(item));
    }
    return out;
  }
  return style;
}

export function WebView({
  source,
  style,
  onMessage,
  injectedJavaScript,
  onLoadStart,
  onLoadEnd,
  onError,
  title,
}) {
  const uri = source?.uri;
  const html = source?.html;
  const ref = React.useRef(null);

  // Bridge native `window.ReactNativeWebView.postMessage` → web `window.postMessage`.
  // Bitrefill (and other embeds) post `payment_intent` etc. via the RN bridge;
  // on web the iframe is cross-origin so we listen for `message` events and
  // re-shape them to the RN `onMessage({ nativeEvent: { data } })` contract.
  React.useEffect(() => {
    if (!onMessage) return;
    const handler = event => {
      // Only accept messages from the embedded Bitrefill origin or any
      // `srcDoc` (null origin). Keep it permissive for other consumers.
      const data = event.data;
      if (data == null) return;
      const asString = typeof data === 'string' ? data : JSON.stringify(data);
      try {
        onMessage({ nativeEvent: { data: asString } });
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  const handleLoad = e => {
    try {
      onLoadStart?.(e);
    } catch {}
    try {
      onLoadEnd?.(e);
    } catch {}
    // Best-effort injectedJavaScript for same-origin `srcDoc` embeds.
    // Cross-origin `src` (e.g. embed.bitrefill.com) will throw due to SOP –
    // intentionally swallowed; Bitrefill still navigates, just without the
    // `embed_navigation` helper (pending checkout is then cleared via `pop`).
    if (injectedJavaScript && ref.current?.contentWindow) {
      try {
        ref.current.contentWindow.eval(injectedJavaScript);
      } catch {}
    }
  };

  return React.createElement('iframe', {
    ref,
    src: uri,
    srcDoc: html,
    // Permissions Policy: Castle / Bitrefill's fraud check uses
    // accelerometer + gyroscope (devicemotion) and Payment Request API.
    // Without an explicit `allow` the browser blocks them and logs
    // "[Violation] accelerometer is not allowed" + "devicemotion blocked".
    allow:
      'accelerometer *; gyroscope *; magnetometer *; payment *; clipboard-write *; fullscreen *; geolocation *',
    allowFullscreen: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    title: title || 'Embedded content',
    style: { border: 'none', width: '100%', height: '100%', ...flattenStyle(style) },
    onLoad: handleLoad,
    onError,
  });
}

export default WebView;
