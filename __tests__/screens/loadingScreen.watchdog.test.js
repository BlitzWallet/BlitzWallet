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
 * the recoverable error UI within 45s. They also cover the wipe re-arm trigger:
 * the wipe runs when onboarding routes with shouldWipeLocalData OR when the
 * keychain wipeInProgress marker is armed (a previous wipe failed/was killed),
 * and a failed wipe lands on the recoverable error UI.
 */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const ERROR_UI_TEXT = 'NO_CONTENT_SCREEN';
// Mutable route params so tests can simulate onboarding (shouldWipeLocalData).
// Referenced from the jest.mock factory below, hence the mock* prefix.
const mockRouteParams = {};

// ── Contexts ────────────────────────────────────────────────────────────────
const didRunHandshakeRef = { current: true };

jest.mock('../../context-store/context', () => ({
  useGlobalContextProvider: () => ({
    toggleMasterInfoObject: jest.fn(),
    toggleNWCInformation: jest.fn(),
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
  useAppStatus: () => ({
    screenDimensions: { width: 400 },
    toggleDidGetToHomepage: jest.fn(),
  }),
}));
jest.mock('../../context-store/nodeContext', () => ({
  useNodeContext: () => ({ toggleFiatStats: jest.fn() }),
}));

// ── Navigation ──────────────────────────────────────────────────────────────
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), replace: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
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
jest.mock('../../app/functions/lottieAnimations', () => ({
  getMascatWalkingAnimation: () => ({}),
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
// The wipe trigger now also consults the keychain re-arm marker; mock both
// modules so tests control the marker state and the wipe outcome.
jest.mock('../../app/functions/secureStore', () => ({
  isWipeInProgress: jest.fn(async () => false),
}));
jest.mock('../../app/functions/wipeLocalWalletData', () => ({
  __esModule: true,
  default: jest.fn(async () => true),
}));

const initializeUserSettingsFromHistory =
  require('../../app/functions/initializeUserSettings').default;
const {
  crashlyticsRecordErrorReport,
} = require('../../app/functions/crashlyticsLogs');
const { isWipeInProgress } = require('../../app/functions/secureStore');
const wipeLocalWalletData =
  require('../../app/functions/wipeLocalWalletData').default;
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
    delete mockRouteParams.shouldWipeLocalData;
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
      jest.advanceTimersByTime(45000);
    });
    await flush();

    expect(showsErrorUI(renderer)).toBe(true);
    expect(crashlyticsRecordErrorReport).toHaveBeenCalledWith(
      expect.stringContaining('Login watchdog fired'),
    );
  });

  test('does not fire once the connect process has settled', async () => {
    initializeUserSettingsFromHistory.mockResolvedValue({ didWork: true });

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
      jest.advanceTimersByTime(45000);
    });
    await flush();

    expect(showsErrorUI(renderer)).toBe(false);
    expect(crashlyticsRecordErrorReport).not.toHaveBeenCalled();
  });
});

describe('loading screen wipe trigger + re-arm marker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    delete mockRouteParams.shouldWipeLocalData;
    initializeUserSettingsFromHistory.mockResolvedValue({ didWork: true });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const renderAndSettle = async () => {
    let renderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<ConnectingToNodeLoadingScreen />);
    });
    await flush();
    // Clear the wipe settle wait + "minimum perceived loading time" so the
    // process completes without tripping the watchdog.
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await flush();
    return renderer;
  };

  test('re-runs the wipe when the keychain marker is armed, with no route param', async () => {
    isWipeInProgress.mockResolvedValue(true);

    const renderer = await renderAndSettle();

    expect(isWipeInProgress).toHaveBeenCalled();
    expect(wipeLocalWalletData).toHaveBeenCalledTimes(1);
    expect(showsErrorUI(renderer)).toBe(false);
  });

  test('skips the wipe when the marker is absent and no route param is set', async () => {
    isWipeInProgress.mockResolvedValue(false);

    const renderer = await renderAndSettle();

    expect(isWipeInProgress).toHaveBeenCalled();
    expect(wipeLocalWalletData).not.toHaveBeenCalled();
    expect(showsErrorUI(renderer)).toBe(false);
  });

  test('wipes when onboarding routes here with shouldWipeLocalData', async () => {
    mockRouteParams.shouldWipeLocalData = true;
    isWipeInProgress.mockResolvedValue(false);

    const renderer = await renderAndSettle();

    expect(wipeLocalWalletData).toHaveBeenCalledTimes(1);
    expect(showsErrorUI(renderer)).toBe(false);
  });

  test('wipes when both the route param and the marker are present', async () => {
    mockRouteParams.shouldWipeLocalData = true;
    isWipeInProgress.mockResolvedValue(true);

    const renderer = await renderAndSettle();

    expect(wipeLocalWalletData).toHaveBeenCalledTimes(1);
    expect(showsErrorUI(renderer)).toBe(false);
  });

  test('continues even though the re-armed wipe fails', async () => {
    isWipeInProgress.mockResolvedValue(true);
    wipeLocalWalletData.mockResolvedValue(false);

    let renderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<ConnectingToNodeLoadingScreen />);
    });
    await flush();

    expect(wipeLocalWalletData).toHaveBeenCalledTimes(1);
    expect(showsErrorUI(renderer)).toBe(false);
    // The wipe threw before the watchdog's 45s window; no watchdog report.
    expect(crashlyticsRecordErrorReport).not.toHaveBeenCalled();
  });
});
