/* eslint-env jest */
// Global test setup. Runs before every test file (see `setupFiles` in
// jest.config.js). Put mocks here that virtually every test needs so individual
// test files don't have to re-declare them.

// @react-native-firebase touches native modules (RNFBAppModule) at import time,
// which don't exist under Jest. Stub the submodules the app imports so any module
// that transitively pulls in Firebase can be unit-tested. Individual tests can
// still override these with their own jest.mock(...) when they need return values.
const makeCallable = () => jest.fn(() => jest.fn(async () => ({ data: {} })));

jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
  getApp: jest.fn(() => ({})),
  firebase: { app: jest.fn(() => ({})) },
}));

jest.mock('@react-native-firebase/functions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ httpsCallable: makeCallable() })),
  getFunctions: jest.fn(() => ({})),
  httpsCallable: makeCallable(),
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({ currentUser: null })),
  getAuth: jest.fn(() => ({ currentUser: null })),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
  getFirestore: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
  getMessaging: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/crashlytics', () => ({
  __esModule: true,
  default: jest.fn(() => ({ recordError: jest.fn(), log: jest.fn() })),
  getCrashlytics: jest.fn(() => ({ recordError: jest.fn(), log: jest.fn() })),
}));

jest.mock('@react-native-firebase/storage', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
  getStorage: jest.fn(() => ({})),
}));

// @react-native-async-storage/async-storage's native module is null under Jest
// and throws at import time. Any module importing app/functions/localStorage.js
// transitively pulls it in. Use the library's official in-memory jest mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-web-browser ships untranspiled ESM (Cannot use import statement outside a
// module) and touches native code. Stub the one method app/functions/openWebBrowser
// uses so screens that open external links (e.g. confirmTxPage) can be unit-tested.
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'opened' })),
}));

// waitForForground() resolves only when AppState.currentState === 'active', which
// is undefined under Jest, so it would hang forever. Tests run "in foreground";
// resolve immediately for every caller (receive/send screens).
jest.mock('./app/hooks/useWaitForForground', () => ({
  waitForForground: jest.fn(async () => {}),
}));

// react-native-localize is a native module (RNLocalize) that throws at import
// time under Jest. Provide a sensible English default; tests can override locally.
jest.mock('react-native-localize', () => ({
  getLocales: jest.fn(() => [
    { languageCode: 'en', countryCode: 'US', languageTag: 'en-US', isRTL: false },
  ]),
}));

// react-native-quick-crypto is a Nitro/Turbo native module that throws at import
// time under Jest. Delegate to Node's crypto so modules in the encryption chain
// (e.g. messaging/encodingAndDecodingMessages.js) load AND actually work.
// `node:crypto` bypasses the Babel alias that maps 'crypto' -> quick-crypto.
// Tests needing different behavior can still jest.mock(...) it locally.
jest.mock('react-native-quick-crypto', () => {
  const nodeCrypto = require('node:crypto');
  const api = {
    randomBytes: (...args) => nodeCrypto.randomBytes(...args),
    createCipheriv: (...args) => nodeCrypto.createCipheriv(...args),
    createDecipheriv: (...args) => nodeCrypto.createDecipheriv(...args),
    createHash: (...args) => nodeCrypto.createHash(...args),
    createHmac: (...args) => nodeCrypto.createHmac(...args),
    pbkdf2: (...args) => nodeCrypto.pbkdf2(...args),
    pbkdf2Sync: (...args) => nodeCrypto.pbkdf2Sync(...args),
    argon2: (_variant, opts, cb) => {
      const msg =
        typeof opts.message === 'string'
          ? Buffer.from(opts.message, 'utf8')
          : opts.message;
      const key = nodeCrypto.pbkdf2Sync(msg, opts.nonce, 1, 32, 'sha256');
      cb(null, key);
    },
  };
  return { __esModule: true, default: api, ...api };
});
