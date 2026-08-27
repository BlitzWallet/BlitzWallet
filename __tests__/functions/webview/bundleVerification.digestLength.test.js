/* eslint-env jest */
// The Ed25519 verify() call must receive a 32-byte sha256 digest; assert the
// length explicitly instead of relying on the crypto library to reject a
// wrong-length buffer if the hashing code ever changes.

let mockRead;
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...a) => mockRead(...a),
  writeAsStringAsync: async () => {},
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
      digest: () => 'ab'.repeat(31), // wrong-length digest
    };
    return hasher;
  },
}));

Object.assign(process.env, { SPARK_WEBVIEW_SIGNING_PUBKEY: 'cd'.repeat(32) });

const {
  verifyAndPrepareWebView,
} = require('../../../app/functions/webview/bundleVerification');

describe('digest length guard', () => {
  test('a non-32-byte digest is rejected as tamper before verify()', async () => {
    const html = [
      '<!doctype html><html><head>',
      `<meta name="blitz-webview-sig" content="${'ab'.repeat(64)}">`,
      `<script nonce="__INJECT_NONCE__"></script>`,
      '</head><body></body></html>',
    ].join('\n');
    mockRead = async () => html;
    const err = await verifyAndPrepareWebView('src').catch(e => e);
    expect(err.isTamper).toBe(true);
    expect(err.message).toContain('Unexpected digest length');
  });
});
