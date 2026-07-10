import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

// ---------------------------------------------------------------------------
// BiometricsLogin is a state machine with almost nothing visible in the render
// tree: the only observable React surface is the login button's `disabled`
// prop and its `actionFunction`. Everything else is side effects on mocked
// dependencies — decryptMnemonicWithBiometrics (the OS prompt), navigate.*,
// setAccountMnemonic. The tests drive the two entry points (the 500ms
// auto-trigger and a manual button tap) and assert on those side effects.
//
// The bugs under test:
//   RC1  the button used to initialize disabled=true and only ever re-enable
//        from inside the focus-gated auth flow — so a stuck Android focus
//        signal left it permanently disabled with no prompt. It must now start
//        enabled and be tappable regardless of focus.
//   race a second concurrent attempt (auto-trigger + tap, or a double tap)
//        must never launch a second biometric prompt.
//   nav  a completed login must never navigate twice.
//   retry a genuine failure counts toward the 3-strike factory-reset prompt;
//        OS churn / foregrounding resets the counter.
// ---------------------------------------------------------------------------

// Mutable context/hook state the mocks read on every render.
const mockAppStatus = { appState: 'active', isAppFocused: true };
let mockIsFocused = true;
const mockNavigate = { replace: jest.fn(), navigate: jest.fn() };
const mockSetAccountMnemonic = jest.fn();

const mockRetrieveData = jest.fn();
const mockStoreData = jest.fn();
const mockDecrypt = jest.fn();
const mockLoginSecuritySwitch = jest.fn();
const mockFactoryReset = jest.fn();

jest.mock('../app/constants', () => ({
  COLORS: { darkModeText: '#fff', primary: '#00f' },
  ICONS: { logoIcon: 1 },
  SIZES: { xxLarge: 30 },
}));

jest.mock('expo-image', () => ({ Image: () => null }));

jest.mock('../app/functions/CustomElements', () => ({
  ThemeText: () => null,
}));

jest.mock('../app/functions/CustomElements/button', () => ({
  __esModule: true,
  default: props => {
    const R = require('react');
    // A host element so react-test-renderer can find it and expose its props.
    return R.createElement('MockButton', props);
  },
}));

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

jest.mock('../app/hooks/themeColors', () => ({
  __esModule: true,
  default: () => ({ backgroundOffset: '#111' }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigate,
  useIsFocused: () => mockIsFocused,
}));

jest.mock('../app/functions', () => ({
  retrieveData: (...args) => mockRetrieveData(...args),
  storeData: (...args) => mockStoreData(...args),
}));

jest.mock('../app/functions/handleMnemonic', () => ({
  decryptMnemonicWithBiometrics: (...args) => mockDecrypt(...args),
  handleLoginSecuritySwitch: (...args) => mockLoginSecuritySwitch(...args),
}));

jest.mock('../app/functions/hash', () => ({
  __esModule: true,
  default: () => 'HASHED',
}));

jest.mock('../context-store/keys', () => ({
  useKeysContext: () => ({ setAccountMnemonic: mockSetAccountMnemonic }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

jest.mock('react-native-restart-newarch', () => ({
  __esModule: true,
  default: { restart: jest.fn() },
}));

jest.mock('../app/functions/factoryResetWallet', () => ({
  __esModule: true,
  default: (...args) => mockFactoryReset(...args),
}));

jest.mock('../context-store/appStatus', () => ({
  useAppStatus: () => mockAppStatus,
}));

const BiometricsLogin =
  require('../app/components/admin/loginComponents/biometricsPage').default;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The most recently mounted renderer, torn down in afterEach so a still-armed
// 500ms auto-trigger can't fire its async flow loose after the test finishes.
let currentRenderer;

function mount() {
  act(() => {
    currentRenderer = ReactTestRenderer.create(<BiometricsLogin />);
  });
  return currentRenderer;
}

function button(renderer) {
  return renderer.root.findByType('MockButton');
}

// Flush the chained microtasks of the async auth flow (retrieveData -> decrypt
// -> setState -> finally). Generous iteration count so multi-await chains fully
// settle under fake timers.
async function flush() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

// Fire the 500ms auto-trigger and settle the resulting flow.
async function fireAutoTrigger() {
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  await flush();
}

// Manually press the button and settle the flow.
async function tap(renderer) {
  await act(async () => {
    await button(renderer).props.actionFunction();
  });
  await flush();
}

// Re-render so hook mocks re-read the mutated context state (simulates a
// context update driving the focus effect).
async function rerender(renderer) {
  await act(async () => {
    renderer.update(<BiometricsLogin />);
  });
  await flush();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => {});

  mockAppStatus.appState = 'active';
  mockAppStatus.isAppFocused = true;
  mockIsFocused = true;

  mockNavigate.replace.mockReset();
  mockNavigate.navigate.mockReset();
  mockSetAccountMnemonic.mockReset();
  mockStoreData.mockReset();
  mockFactoryReset.mockReset();

  // Default: a normal (non-migration) account. pinHash is a non-JSON hash, so
  // needsToBeMigrated is false and the flow goes straight to biometrics.
  mockRetrieveData.mockReset();
  mockRetrieveData.mockImplementation(async key => {
    if (key === 'pinHash') return { didWork: true, value: 'not-json-hash' };
    if (key === 'encryptedMnemonic')
      return { didWork: true, value: 'ENCRYPTED' };
    return { didWork: true, value: null };
  });

  // Default: biometrics succeed.
  mockDecrypt.mockReset();
  mockDecrypt.mockResolvedValue('seed words');

  mockLoginSecuritySwitch.mockReset();
  mockLoginSecuritySwitch.mockResolvedValue(true);
});

afterEach(() => {
  // Unmount first: the cleanup effect clears any armed auto-trigger timer so it
  // can't fire an async flow into a torn-down tree.
  act(() => {
    currentRenderer?.unmount();
  });
  currentRenderer = undefined;
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// RC1 — the deadlock fix: button is never stuck disabled with no prompt
// ---------------------------------------------------------------------------

describe('BiometricsLogin - never deadlocks (RC1)', () => {
  test('the button starts enabled', () => {
    const renderer = mount();
    expect(button(renderer).props.disabled).toBe(false);
  });

  test('with a stuck focus signal (isAppFocused=false) it never auto-prompts, but the button stays tappable and works', async () => {
    // Reproduces the reported wedge: the Android focus event never arrives, so
    // the auto-trigger can never fire.
    mockAppStatus.isAppFocused = false;
    const renderer = mount();

    await fireAutoTrigger();
    expect(mockDecrypt).not.toHaveBeenCalled();
    // The old bug: button would be disabled here. It must be tappable.
    expect(button(renderer).props.disabled).toBe(false);

    // Manual fallback recovers the login.
    await tap(renderer);
    expect(mockDecrypt).toHaveBeenCalledTimes(1);
    expect(mockSetAccountMnemonic).toHaveBeenCalledWith('seed words');
    expect(mockNavigate.replace).toHaveBeenCalledWith(
      'ConnectingToNodeLoadingScreen',
      { expectedMnemonicHash: 'HASHED' },
    );
  });
});

// ---------------------------------------------------------------------------
// Auto-trigger behaviour
// ---------------------------------------------------------------------------

describe('BiometricsLogin - auto-trigger', () => {
  test('prompts and logs in ~500ms after mounting fully focused', async () => {
    const renderer = mount();
    await fireAutoTrigger();

    expect(mockDecrypt).toHaveBeenCalledTimes(1);
    expect(mockSetAccountMnemonic).toHaveBeenCalledWith('seed words');
    expect(mockNavigate.replace).toHaveBeenCalledTimes(1);
    expect(mockNavigate.replace).toHaveBeenCalledWith(
      'ConnectingToNodeLoadingScreen',
      { expectedMnemonicHash: 'HASHED' },
    );
  });

  test('does not prompt while not fully focused', async () => {
    mockIsFocused = false;
    mount();
    await fireAutoTrigger();
    expect(mockDecrypt).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Race guards — no double prompt, no double navigation
// ---------------------------------------------------------------------------

describe('BiometricsLogin - race guards', () => {
  test('a double tap only launches one biometric prompt', async () => {
    mockAppStatus.isAppFocused = false; // no auto-trigger interference
    const renderer = mount();

    await act(async () => {
      const p1 = button(renderer).props.actionFunction();
      const p2 = button(renderer).props.actionFunction();
      await Promise.all([p1, p2]);
    });
    await flush();

    expect(mockDecrypt).toHaveBeenCalledTimes(1);
  });

  test('the auto-trigger and a manual tap together only prompt once', async () => {
    // Keep the prompt pending so both entry points overlap in flight.
    let resolveDecrypt;
    mockDecrypt.mockImplementation(
      () => new Promise(res => (resolveDecrypt = res)),
    );

    const renderer = mount();

    await act(async () => {
      jest.advanceTimersByTime(500); // auto-trigger starts the (pending) prompt
    });
    await act(async () => {
      button(renderer).props.actionFunction(); // manual tap while in flight
    });

    await act(async () => {
      resolveDecrypt('seed words');
      await Promise.resolve();
    });
    await flush();

    expect(mockDecrypt).toHaveBeenCalledTimes(1);
    expect(mockNavigate.replace).toHaveBeenCalledTimes(1);
  });

  test('a completed login never navigates twice, even if tapped again', async () => {
    mockAppStatus.isAppFocused = false; // control the flow purely via taps
    const renderer = mount();

    await tap(renderer);
    expect(mockNavigate.replace).toHaveBeenCalledTimes(1);

    // didNavigate guard: a second tap after success is a no-op.
    await tap(renderer);
    expect(mockNavigate.replace).toHaveBeenCalledTimes(1);
    expect(mockDecrypt).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Retry escalation + reset
// ---------------------------------------------------------------------------

describe('BiometricsLogin - retry handling', () => {
  test('escalates to the factory-reset confirmation after 3 genuine failures', async () => {
    mockAppStatus.isAppFocused = false; // manual control, no auto retries
    mockDecrypt.mockResolvedValue(false); // every attempt fails
    const renderer = mount();

    await tap(renderer); // fail 1
    await tap(renderer); // fail 2
    await tap(renderer); // fail 3
    expect(mockDecrypt).toHaveBeenCalledTimes(3);
    expect(mockNavigate.navigate).not.toHaveBeenCalled();

    await tap(renderer); // 4th attempt short-circuits to the reset prompt
    expect(mockDecrypt).toHaveBeenCalledTimes(3); // no 4th prompt
    expect(mockNavigate.navigate).toHaveBeenCalledWith(
      'ConfirmActionPage',
      expect.objectContaining({
        confirmMessage: 'adminLogin.pinPage.isBiometricEnabledConfirmAction',
      }),
    );
  });

  test('foregrounding resets the retry counter so the user is not marched toward reset', async () => {
    mockAppStatus.isAppFocused = false; // start not-focused: no auto-trigger
    mockDecrypt.mockResolvedValue(false);
    const renderer = mount();

    await tap(renderer); // fail 1
    await tap(renderer); // fail 2
    await tap(renderer); // fail 3
    expect(mockDecrypt).toHaveBeenCalledTimes(3);

    // App comes to the foreground -> focus effect resets retries to 0 and
    // arms the auto-trigger. Without the reset this next attempt would hit the
    // 3-strike escalation instead of prompting.
    mockAppStatus.isAppFocused = true;
    await rerender(renderer);
    await fireAutoTrigger();

    expect(mockNavigate.navigate).not.toHaveBeenCalled();
    expect(mockDecrypt).toHaveBeenCalledTimes(4); // a fresh prompt, not escalation
  });
});

// ---------------------------------------------------------------------------
// Legacy migration path (JSON pinHash)
// ---------------------------------------------------------------------------

describe('BiometricsLogin - legacy migration', () => {
  beforeEach(() => {
    // A JSON-array pinHash marks a legacy account that needs migration.
    mockRetrieveData.mockImplementation(async key => {
      if (key === 'pinHash') return { didWork: true, value: '[1,2,3,4]' };
      if (key === 'encryptedMnemonic')
        return { didWork: true, value: 'LEGACY_MNEMONIC' };
      return { didWork: true, value: null };
    });
  });

  test('migrates and logs in without calling the biometric decrypt path', async () => {
    const renderer = mount();
    await tap(renderer);

    expect(mockLoginSecuritySwitch).toHaveBeenCalledWith(
      'LEGACY_MNEMONIC',
      '',
      'biometric',
    );
    expect(mockDecrypt).not.toHaveBeenCalled();
    expect(mockSetAccountMnemonic).toHaveBeenCalledWith('LEGACY_MNEMONIC');
    expect(mockNavigate.replace).toHaveBeenCalledWith(
      'ConnectingToNodeLoadingScreen',
      { expectedMnemonicHash: 'HASHED' },
    );
  });

  test('a failed migration routes to the factory-reset confirmation', async () => {
    mockLoginSecuritySwitch.mockResolvedValue(false);
    const renderer = mount();
    await tap(renderer);

    expect(mockNavigate.replace).not.toHaveBeenCalled();
    expect(mockNavigate.navigate).toHaveBeenCalledWith(
      'ConfirmActionPage',
      expect.objectContaining({
        confirmMessage: 'adminLogin.pinPage.isBiometricEnabledConfirmAction',
      }),
    );
  });
});
