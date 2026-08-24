/* eslint-env jest */
// S-5 — a transient IO failure (disk hiccup) during bundle verification must NOT
// be treated like tamper: only integrity failures (missing/invalid signature,
// nonce injection) may persist the FORCE_REACT_NATIVE kill-switch. Tamper errors
// carry `isTamper === true`; transient IO errors do not.

let mockRead;
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...a) => mockRead(...a),
  writeAsStringAsync: jest.fn(async () => {}),
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

const {
  verifyAndPrepareWebView,
} = require('../../../app/functions/webview/bundleVerification');

describe('verifyAndPrepareWebView error tagging', () => {
  test('a transient IO read failure is NOT tagged as tamper', async () => {
    mockRead = async () => {
      throw new Error('disk read failed');
    };
    await expect(verifyAndPrepareWebView('src')).rejects.toMatchObject({
      message: 'disk read failed',
    });
    const err = await verifyAndPrepareWebView('src').catch(e => e);
    expect(err.isTamper).toBeFalsy();
  });

  test('a missing signature (tamper) IS tagged isTamper', async () => {
    mockRead = async () => '<html>no signature here</html>';
    const err = await verifyAndPrepareWebView('src').catch(e => e);
    expect(err.isTamper).toBe(true);
  });
});
