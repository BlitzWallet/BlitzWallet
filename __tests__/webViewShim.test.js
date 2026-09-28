import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { WebView } from '../web-shims/react-native-webview';

// Under the react-native preset `window` is `global` with no DOM events, so
// capture the shim's `message` listener and feed it MessageEvent-shaped input.
let listeners;
beforeEach(() => {
  listeners = new Set();
  window.addEventListener = (type, fn) =>
    type === 'message' && listeners.add(fn);
  window.removeEventListener = (type, fn) => listeners.delete(fn);
});
afterEach(() => {
  delete window.addEventListener;
  delete window.removeEventListener;
});

const ORIGIN = 'https://embed.bitrefill.com';
const frame = {}; // stands in for the iframe's contentWindow
const intent = JSON.stringify({
  event: 'payment_intent',
  paymentUri: 'lnbc10n1attackerinvoice',
});

function renderWebView() {
  const onMessage = jest.fn();
  act(() => {
    ReactTestRenderer.create(
      <WebView
        source={{ uri: `${ORIGIN}/?ref=blitz` }}
        onMessage={onMessage}
      />,
      { createNodeMock: () => ({ contentWindow: frame }) },
    );
  });
  return onMessage;
}

const post = event => listeners.forEach(fn => fn(event));

const permissionFeatures = [
  'accelerometer', 'gyroscope', 'magnetometer', 'payment',
  'clipboard-write', 'fullscreen', 'geolocation',
];

function renderFrame(source, props = {}) {
  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(<WebView source={source} {...props} />);
  });
  return renderer.toJSON();
}

describe('web WebView permissions', () => {
  test.each([
    'https://merchant.example',
    'https://embed.bitrefill.com.other.example',
    'https://embed.bitrefill.com@other.example',
    'http://embed.bitrefill.com',
    'https://embed.bitrefill.com:444',
  ])('denies sensitive permissions to ordinary embeds: %s', uri => {
    const iframe = renderFrame({ uri });
    for (const feature of permissionFeatures) {
      expect(iframe.props.allow.split('; ')).toContain(`${feature} 'none'`);
    }
    expect(iframe.props.allowFullscreen).toBe(false);
  });

  test('limits checkout permissions to the exact HTTPS Bitrefill origin', () => {
    const iframe = renderFrame({ uri: `${ORIGIN}/?ref=blitz` });
    for (const feature of permissionFeatures) {
      expect(iframe.props.allow.split('; ')).toContain(`${feature} ${ORIGIN}`);
    }
    expect(iframe.props.allow).not.toContain('*');
    expect(iframe.props.allowFullscreen).toBe(true);
  });

  test('does not grant checkout permissions to srcDoc with a Bitrefill fallback URI', () => {
    const iframe = renderFrame({ uri: ORIGIN, html: '<p>fixture</p>' });
    expect(iframe.props.allow).toContain("geolocation 'none'");
    expect(iframe.props.allow).toContain("accelerometer 'none'");
  });

  test.each(['javascript:void(0)', 'data:text/html,fixture', 'not a URL'])(
    'rejects invalid sources even when an onMessage handler is supplied: %s',
    uri => {
      expect(renderFrame({ uri }, { onMessage: jest.fn() })).toBeNull();
      expect(listeners.size).toBe(0);
    },
  );
});

describe('web WebView shim onMessage', () => {
  test('ignores other windows, even at the embed origin', () => {
    // An opener, popup, or frame nested inside the embed is not our iframe.
    const onMessage = renderWebView();
    post({ source: {}, origin: ORIGIN, data: intent });
    expect(onMessage).not.toHaveBeenCalled();
  });

  test('ignores its own iframe once it shows another origin', () => {
    const onMessage = renderWebView();
    post({ source: frame, origin: 'https://evil.example', data: intent });
    expect(onMessage).not.toHaveBeenCalled();
  });

  test('delivers its own iframe at the source origin', () => {
    const onMessage = renderWebView();
    post({ source: frame, origin: ORIGIN, data: intent });
    expect(onMessage).toHaveBeenCalledWith({ nativeEvent: { data: intent } });
  });
});
