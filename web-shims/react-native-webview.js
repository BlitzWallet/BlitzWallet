// Web shim for react-native-webview. The core wallet no longer uses the
// offscreen Spark WebView on web (see webViewContext.web.js). Remaining
// consumers (bitrefill/webViewPopup) render an <iframe>; deferred features
// keep it importable.
import React from 'react';

export function WebView({ source, style }) {
  const uri = source?.uri;
  const html = source?.html;
  return React.createElement('iframe', {
    src: uri,
    srcDoc: html,
    style: { border: 'none', width: '100%', height: '100%', ...(style || {}) },
  });
}

export default WebView;
