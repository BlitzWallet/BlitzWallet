/* eslint-env jest */
// Structural integrity hardening around the Ed25519 signature: the pinned key
// is the trust anchor, so these checks ensure the canonical bytes handed to
// sha256 can only encode the intended document shape (one head-region sig meta,
// one unambiguous __SIGNATURE__ slot) and that nonce injection consumes every
// substitutable placeholder exactly once without disturbing sentinel literals.

let mockRead;
let written;
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...a) => mockRead(...a),
  writeAsStringAsync: (path, html) => {
    written = { path, html };
    return Promise.resolve();
  },
  bundleDirectory: 'file:///bundle/',
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
}));
jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('react-native-quick-crypto', () => ({
  randomBytes: () => Buffer.alloc(16, 7),
  verify: () => true,
  createPublicKey: () => ({}),
  createHash: () => {
    const hasher = {
      update: () => hasher,
      digest: () => 'ab'.repeat(32),
    };
    return hasher;
  },
}));

Object.assign(process.env, { SPARK_WEBVIEW_SIGNING_PUBKEY: 'cd'.repeat(32) });

const {
  verifyAndPrepareWebView,
} = require('../../../app/functions/webview/bundleVerification');

const SIG = 'ab'.repeat(64);
const NONCE_HEX = '07'.repeat(16);

const validHtml = [
  '<!doctype html><html><head>',
  `<meta name="blitz-webview-sig" content="${SIG}">`,
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'nonce-__INJECT_NONCE__'">`,
  '<script nonce="__INJECT_NONCE__">',
  'if (!v || v === "__INJECT_NONCE__") warn();',
  '</script></head><body></body></html>',
].join('\n');

describe('verifyAndPrepareWebView structural hardening', () => {
  beforeEach(() => {
    written = undefined;
    mockRead = async () => validHtml;
  });

  test('well-formed bundle passes and injects the nonce exactly once per slot', async () => {
    const result = await verifyAndPrepareWebView('src');
    expect(result.nonceHex).toBe(NONCE_HEX);
    const out = written.html;
    expect(out.split(NONCE_HEX).length - 1).toBe(2);
    expect(out.split('__INJECT_NONCE__').length - 1).toBe(1);
  });

  test('signature meta beyond the head-region offset bound is rejected', async () => {
    const padding = '<!-- pad -->'.repeat(100); // > 1024 bytes before the meta
    mockRead = async () =>
      `<!doctype html><html><head>\n${padding}\n${validHtml.split('\n')[1]}\n</head><body></body></html>`;
    const err = await verifyAndPrepareWebView('src').catch(e => e);
    expect(err.isTamper).toBe(true);
    expect(err.message).toContain('outside head region');
  });

  test('a second signature meta surviving substitution is rejected', async () => {
    mockRead = async () =>
      `${validHtml}\n<meta name="blitz-webview-sig" content="${'ef'.repeat(64)}">`;
    const err = await verifyAndPrepareWebView('src').catch(e => e);
    expect(err.isTamper).toBe(true);
    expect(err.message).toContain('malformed signature slots');
  });

  test('a planted literal __SIGNATURE__ makes the signed bytes ambiguous', async () => {
    mockRead = async () =>
      validHtml.replace('</head>', '__SIGNATURE__</head>');
    const err = await verifyAndPrepareWebView('src').catch(e => e);
    expect(err.isTamper).toBe(true);
    expect(err.message).toContain('malformed signature slots');
  });

  test('a missing script-attribute placeholder still fails closed', async () => {
    mockRead = async () =>
      validHtml.replace('<script nonce="__INJECT_NONCE__">', '<script>');
    const err = await verifyAndPrepareWebView('src').catch(e => e);
    expect(err.isTamper).toBe(true);
    expect(err.message).toContain('meta or script attribute missing');
  });
});
