import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Web passkey login (PasskeyLoginPage) and the web AdminLogin routing that
// picks it. decryptMnemonicWithPasskey is tri-state: seed | null (cancelled,
// retry-safe, no message) | false (couldn't unlock, message + retry). There
// is no attempt counter and no auto-reset, ever.
// ---------------------------------------------------------------------------

const mockNavigate = { navigate: jest.fn(), replace: jest.fn() };
const mockSetAccountMnemonic = jest.fn();
const mockDecryptWithPasskey = jest.fn();
const mockGetStoredPasskeyInfo = jest.fn();
const mockFactoryReset = jest.fn();

jest.mock('../app/constants', () => ({
  CENTER: {},
  COLORS: { gray: '#888', cancelRed: '#f00' },
  ICONS: { logoIcon: 'logo' },
  SIZES: { xxLarge: 30, smedium: 16, small: 12 },
}));

jest.mock('../app/functions/CustomElements', () => ({
  GlobalThemeView: ({ children }) => children,
  ThemeText: props =>
    require('react').createElement('MockText', { children: props.content }),
}));

jest.mock('../app/functions/CustomElements/button', () => ({
  __esModule: true,
  default: props => require('react').createElement('MockButton', props),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

jest.mock('../context-store/keys', () => ({
  useKeysContext: () => ({ setAccountMnemonic: mockSetAccountMnemonic }),
}));

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

// The theme context only needs storage access; mocking the barrel keeps the
// rest of the app import graph (clipboard, sharing, sqlite, ...) out of Jest.
jest.mock('../app/functions', () => ({
  setLocalStorageItem: jest.fn(async () => {}),
  getLocalStorageItem: jest.fn(async () => null),
}));

// PasskeyLoginPage renders an expo-image logo, a native module that doesn't
// exist under Jest.
jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('../app/functions/passkeyMnemonic', () => ({
  decryptMnemonicWithPasskey: (...args) => mockDecryptWithPasskey(...args),
  getStoredPasskeyInfo: (...args) => mockGetStoredPasskeyInfo(...args),
}));

jest.mock('../app/functions/factoryResetWallet', () => ({
  __esModule: true,
  default: (...args) => mockFactoryReset(...args),
}));

jest.mock('../app/functions/hash', () => ({
  __esModule: true,
  default: () => 'HASHED',
}));

// PasskeyLoginPage -> theme context -> functions/index -> secureStore touches
// the expo-secure-store native module, which doesn't exist under Jest.
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

// Same chain reaches biometricAuthentication -> expo-local-authentication,
// also a native module that doesn't exist under Jest.
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
  authenticateAsync: jest.fn(async () => ({ success: false })),
}));

// AdminLogin's other pages: only which one renders matters here.
jest.mock('../app/components/admin/loginComponents/passwordPage', () => ({
  __esModule: true,
  default: () => require('react').createElement('MockPasswordPage'),
}));
jest.mock('../app/components/admin/loginComponents/pinPage', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../app/components/admin/loginComponents/biometricsPage', () => ({
  __esModule: true,
  default: () => null,
}));

const PasskeyLoginPage =
  require('../app/components/admin/loginComponents/passkeyPage').default;
const AdminLogin = require('../app/screens/inAccount/login').default;

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

async function flush() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function mount(element = <PasskeyLoginPage />) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(element);
  });
  await flush();
  return renderer;
}

async function tapUnlock(renderer) {
  await act(async () => {
    await renderer.root.findByType('MockButton').props.actionFunction();
  });
  await flush();
}

const texts = renderer =>
  renderer.root.findAllByType('MockText').map(n => n.props.children);

let originalOS;
beforeEach(() => {
  jest.clearAllMocks();
  originalOS = Platform.OS;
  mockDecryptWithPasskey.mockResolvedValue(MNEMONIC);
  mockGetStoredPasskeyInfo.mockResolvedValue({ credentialId: 'CRED' });
  mockFactoryReset.mockResolvedValue(true);
  global.location = { reload: jest.fn() };
});

afterEach(() => {
  Platform.OS = originalOS;
  delete global.location;
});

describe('PasskeyLoginPage', () => {
  test('opens the passkey prompt once on load and logs in', async () => {
    await mount();

    expect(mockDecryptWithPasskey).toHaveBeenCalledTimes(1);
    expect(mockSetAccountMnemonic).toHaveBeenCalledWith(MNEMONIC);
    expect(mockNavigate.replace).toHaveBeenCalledWith(
      'ConnectingToNodeLoadingScreen',
      { expectedMnemonicHash: 'HASHED' },
    );
  });

  test('cancel: no message, button stays usable, tapping retries', async () => {
    mockDecryptWithPasskey.mockResolvedValueOnce(null);
    const renderer = await mount();

    expect(texts(renderer)).not.toContain('adminLogin.passkeyPage.unlockError');
    expect(renderer.root.findByType('MockButton').props.disabled).toBe(false);

    await tapUnlock(renderer);
    expect(mockDecryptWithPasskey).toHaveBeenCalledTimes(2);
    expect(mockNavigate.replace).toHaveBeenCalledTimes(1);
  });

  test("definitive failure: shows couldn't-unlock, and retry can still succeed", async () => {
    mockDecryptWithPasskey.mockResolvedValueOnce(false);
    const renderer = await mount();

    expect(texts(renderer)).toContain('adminLogin.passkeyPage.unlockError');
    expect(mockNavigate.replace).not.toHaveBeenCalled();

    await tapUnlock(renderer);
    expect(mockNavigate.replace).toHaveBeenCalledTimes(1);
  });

  test('repeated failures never count down or wipe the wallet', async () => {
    mockDecryptWithPasskey.mockResolvedValue(false);
    const renderer = await mount();

    for (let i = 0; i < 10; i++) await tapUnlock(renderer);

    expect(mockDecryptWithPasskey).toHaveBeenCalledTimes(11);
    expect(mockFactoryReset).not.toHaveBeenCalled();
    expect(mockNavigate.navigate).not.toHaveBeenCalled();
  });

  test('a tap while the load prompt is still open does not open a second one', async () => {
    let resolvePrompt;
    mockDecryptWithPasskey.mockImplementationOnce(
      () => new Promise(resolve => (resolvePrompt = resolve)),
    );
    const renderer = await mount();

    await act(async () => {
      renderer.root.findByType('MockButton').props.actionFunction();
    });
    await act(async () => {
      resolvePrompt(MNEMONIC);
    });
    await flush();

    expect(mockDecryptWithPasskey).toHaveBeenCalledTimes(1);
    expect(mockNavigate.replace).toHaveBeenCalledTimes(1);
  });

  test('"Lost your passkey?" confirms, factory-resets, then reloads', async () => {
    mockDecryptWithPasskey.mockResolvedValue(null);
    const renderer = await mount();

    await act(async () => {
      renderer.root.findByProps({ testID: 'lost-passkey' }).props.onPress();
    });
    expect(mockNavigate.navigate).toHaveBeenCalledWith(
      'ConfirmActionPage',
      expect.objectContaining({
        confirmMessage: 'adminLogin.passkeyPage.lostPasskeyConfirm',
      }),
    );

    const { confirmFunction } = mockNavigate.navigate.mock.calls[0][1];
    await act(async () => {
      await confirmFunction();
    });
    expect(mockFactoryReset).toHaveBeenCalledTimes(1);
    expect(global.location.reload).toHaveBeenCalledTimes(1);
  });
});

describe('web AdminLogin routing', () => {
  test('a passkey wallet gets the passkey login', async () => {
    Platform.OS = 'web';
    const renderer = await mount(
      <AdminLogin route={{ params: { usesPasskey: true } }} />,
    );

    expect(renderer.root.findAllByType('MockPasswordPage')).toHaveLength(0);
    expect(mockDecryptWithPasskey).toHaveBeenCalledTimes(1);
  });

  test('a password wallet gets the password login', async () => {
    Platform.OS = 'web';
    const renderer = await mount(
      <AdminLogin route={{ params: { usesPasskey: false } }} />,
    );

    expect(renderer.root.findAllByType('MockPasswordPage')).toHaveLength(1);
    expect(mockDecryptWithPasskey).not.toHaveBeenCalled();
  });
});

test('a completed prompt cannot unlock after leaving the page', async () => {
  let resolvePrompt;
  mockDecryptWithPasskey.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolvePrompt = resolve;
      }),
  );
  const renderer = await mount();
  await act(async () => {
    renderer.unmount();
  });
  await act(async () => {
    resolvePrompt(MNEMONIC);
  });
  await flush();
  expect(mockSetAccountMnemonic).not.toHaveBeenCalled();
  expect(mockNavigate.replace).not.toHaveBeenCalled();
});
