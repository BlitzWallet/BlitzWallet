/**
 * Regression test for the silent infinite-hang on the login loading screen.
 *
 * The watchdog used to key off `didRunConnectionRef`, which is set the instant the
 * connect process is *scheduled* — so the only timeout in the login flow was
 * disarmed exactly when the risky, network-bound work began. Anything that stayed
 * pending forever without rejecting (firestore reads/writes, the NWC spark wallet
 * init) left the user on an endless mascot animation with no error.
 *
 * These tests pin the fixed contract: the process either settles, or the user gets
 * the recoverable error UI within 30s.
 */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const ERROR_UI_TEXT = 'NO_CONTENT_SCREEN';

// ── Contexts ────────────────────────────────────────────────────────────────
const didRunHandshakeRef = { current: true };

jest.mock('../../context-store/context', () => ({
  useGlobalContextProvider: () => ({
    toggleMasterInfoObject: jest.fn(),
    masterInfoObject: {},
    setMasterInfoObject: jest.fn(),
    preloadedUserData: { isLoading: false, data: null },
    setPreLoadedUserData: jest.fn(),
  }),
}));
jest.mock('../../context-store/webViewContext', () => ({
  useWebView: () => ({ didRunHandshakeRef: { current: true } }),
}));
jest.mock('../../context-store/sparkContext', () => ({
  useSparkWallet: () => ({
    connectToSparkWallet: jest.fn(),
    setSparkInformation: jest.fn(),
  }),
}));
jest.mock('../../context-store/keys', () => ({
  useKeysContext: () => ({
    toggleContactsPrivateKey: jest.fn(),
    accountMnemoinc: 'test mnemonic',
  }),
}));
jest.mock('../../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false }),
}));
jest.mock('../../context-store/globalContacts', () => ({
  useGlobalContactsInfo: () => ({ toggleGlobalContactsInformation: jest.fn() }),
}));
jest.mock('../../context-store/appData', () => ({
  useGlobalAppData: () => ({ toggleGlobalAppDataInformation: jest.fn() }),
}));
jest.mock('../../context-store/appStatus', () => ({
  useAppStatus: () => ({ screenDimensions: { width: 400 } }),
}));
jest.mock('../../context-store/nodeContext', () => ({
  useNodeContext: () => ({ toggleFiatStats: jest.fn() }),
}));

// ── Navigation ──────────────────────────────────────────────────────────────
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), replace: jest.fn() }),
  useRoute: () => ({ params: {} }),
  StackActions: { replace: jest.fn(() => ({ type: 'REPLACE' })) },
}));
jest.mock('../../navigation/navigationService', () => ({
  navigationRef: {
    getCurrentRoute: () => ({ name: 'ConnectingToNodeLoadingScreen' }),
    isReady: () => true,
    dispatch: jest.fn(),
  },
}));

// ── UI leaves ───────────────────────────────────────────────────────────────
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: k => k }) }));
jest.mock('lottie-react-native', () => 'LottieView');
jest.mock('../../app/functions/CustomElements', () => ({
  GlobalThemeView: ({ children }) => children,
}));
jest.mock('../../app/functions/CustomElements/themeIcon', () => 'ThemeIcon');
jest.mock('../../app/functions/CustomElements/noContentScreen', () => {
  const MockReact = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => MockReact.createElement(Text, null, 'NO_CONTENT_SCREEN'),
  };
});
jest.mock('../../app/functions/lottieViewColorTransformer', () => ({
  updateMascatWalkingAnimation: () => ({}),
}));
jest.mock('../../app/functions/openWebBrowser', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// ── Boot-path work ──────────────────────────────────────────────────────────
jest.mock('../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
  crashlyticsRecordErrorReport: jest.fn(),
}));
jest.mock('../../app/functions/localStorage', () => ({
  removeLocalStorageItem: jest.fn(),
}));
jest.mock('../../app/functions/hash', () => ({
  __esModule: true,
  default: () => 'hash',
}));
jest.mock('../../app/functions/nostrCompatability', () => ({
  privateKeyFromSeedWords: jest.fn(async () => 'privkey'),
}));
jest.mock('nostr-tools', () => ({ getPublicKey: () => 'pubkey' }));
jest.mock('../../app/functions/gift/deriveGiftWallet', () => ({
  deriveSparkIdentityKey: jest.fn(async () => ({ publicKeyHex: 'abc' })),
}));
jest.mock('../../app/functions/initializeAllDatabases', () => ({
  initializeAllDatabases: jest.fn(async () => true),
}));
jest.mock('../../app/functions/spark', () => ({
  getCachedSparkTransactions: jest.fn(async () => []),
}));
jest.mock('../../app/functions/spark/balanceSnapshots', () => ({
  getAccountBalanceSnapshot: jest.fn(async () => ({ balance: 0 })),
}));
jest.mock('../../app/functions/saveAndUpdateFiatData', () => ({
  getCachedFiatRate: jest.fn(async () => null),
}));
jest.mock('../../app/functions/initializeUserSettings', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const initializeUserSettingsFromHistory =
  require('../../app/functions/initializeUserSettings').default;
const { crashlyticsRecordErrorReport } = require('../../app/functions/crashlyticsLogs');
const ConnectingToNodeLoadingScreen =
  require('../../app/screens/inAccount/loadingScreen').default;

// Let the effect's requestAnimationFrame run synchronously under fake timers.
global.requestAnimationFrame = cb => cb();

const showsErrorUI = renderer =>
  JSON.stringify(renderer.toJSON() ?? '').includes(ERROR_UI_TEXT);

// Drains queued microtasks so pending awaits advance between timer jumps.
const flush = async () => {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('loading screen watchdog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('shows the recoverable error UI when a boot dependency never settles', async () => {
    // The exact failure mode from the field report: a promise that stays pending
    // forever and never rejects, so no try/catch in the chain can see it.
    initializeUserSettingsFromHistory.mockReturnValue(new Promise(() => {}));

    let renderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<ConnectingToNodeLoadingScreen />);
    });
    await flush();

    expect(showsErrorUI(renderer)).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    await flush();

    expect(showsErrorUI(renderer)).toBe(true);
    expect(crashlyticsRecordErrorReport).toHaveBeenCalledWith(
      expect.stringContaining('Login watchdog fired'),
    );
  });

  test('does not fire once the connect process has settled', async () => {
    initializeUserSettingsFromHistory.mockResolvedValue(true);

    let renderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<ConnectingToNodeLoadingScreen />);
    });
    await flush();

    // Clear the "minimum perceived loading time" wait so the process completes.
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await flush();

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    await flush();

    expect(showsErrorUI(renderer)).toBe(false);
    expect(crashlyticsRecordErrorReport).not.toHaveBeenCalled();
  });
});
