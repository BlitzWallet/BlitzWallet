/* eslint-env jest */
// Web Login Security settings: two states read from the stored envelope.
//   password wallet  change password (unchanged) + "Use a passkey instead":
//                    current password -> create + confirm prompts -> the
//                    passkey envelope replaces the password one.
//   passkey wallet   "Switch to password": passkey unlock -> new password ->
//                    forget the old passkey only after the write succeeded.
// Every switch attempt re-reads the envelope, the only source of truth.

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSKEY_INFO = { credentialId: 'OLD_CRED', createdAt: 1757500000000 };

const mockShowToast = jest.fn();
const mockDecryptWithPin = jest.fn();
const mockStoreWithPin = jest.fn();
const mockGetStoredPasskeyInfo = jest.fn();
const mockIsPasskeySupported = jest.fn();
const mockCreatePasskey = jest.fn();
const mockStoreWithPasskey = jest.fn();
const mockDecryptWithPasskey = jest.fn();
const mockForgetPasskey = jest.fn();

jest.mock('../app/constants', () => ({
  CENTER: {},
  COLORS: { darkModeText: '#fff', primary: '#00f' },
  LOGIN_SECUITY_MODE_KEY: 'LOGIN_SECURITY_MODE',
  RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY: 'RANDOM_LOGIN_KEYBOARD_LAYOUT',
  SIZES: { small: 12, large: 20, smedium: 16 },
}));

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

jest.mock('../context-store/keys', () => ({
  useKeysContext: () => ({ accountMnemoinc: MNEMONIC }),
}));

jest.mock('../context-store/toastManager', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('../app/functions', () => ({
  getLocalStorageItem: jest.fn(async () => null),
  hasHardware: jest.fn(),
  hasSavedProfile: jest.fn(),
  setLocalStorageItem: jest.fn(),
}));

jest.mock('../app/functions/CustomElements', () => ({
  ThemeText: props =>
    require('react').createElement('MockText', { children: props.content }),
}));

jest.mock('../app/functions/CustomElements/searchInput', () => ({
  __esModule: true,
  default: props => require('react').createElement('MockInput', props),
}));

jest.mock('../app/functions/CustomElements/button', () => ({
  __esModule: true,
  default: props => require('react').createElement('MockButton', props),
}));

jest.mock('../app/components/admin/loginComponents/passwordCreateForm', () => ({
  __esModule: true,
  default: props => require('react').createElement('MockPasswordForm', props),
}));

jest.mock('../app/components/admin/loginComponents/passkeyIcon', () => ({
  __esModule: true,
  default: () => null,
}));

for (const path of [
  '../app/functions/CustomElements/switch',
  '../app/functions/CustomElements/checkMarkCircle',
  '../app/functions/CustomElements/themeIcon',
  '../app/functions/CustomElements/loadingScreen',
]) {
  jest.mock(path, () => ({ __esModule: true, default: () => null }));
}

jest.mock('../app/hooks/themeColors', () => ({
  __esModule: true,
  default: () => ({ backgroundOffset: '#111', backgroundColor: '#222' }),
}));

jest.mock('../app/functions/handleMnemonic', () => ({
  decryptMnemonicWithPin: (...args) => mockDecryptWithPin(...args),
  storeMnemonicWithPinSecurity: (...args) => mockStoreWithPin(...args),
  handleLoginSecuritySwitch: jest.fn(),
}));

jest.mock('../app/functions/passkeyMnemonic', () => ({
  getStoredPasskeyInfo: (...args) => mockGetStoredPasskeyInfo(...args),
  isPasskeySupported: (...args) => mockIsPasskeySupported(...args),
  createPasskey: (...args) => mockCreatePasskey(...args),
  storeMnemonicWithPasskey: (...args) => mockStoreWithPasskey(...args),
  decryptMnemonicWithPasskey: (...args) => mockDecryptWithPasskey(...args),
  forgetPasskey: (...args) => mockForgetPasskey(...args),
  passkeyName: time => `NAME(${time})`,
}));

const LoginSecurity =
  require('../app/components/admin/homeComponents/settingsContent/loginSecurity').default;

async function flush() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function mount() {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<LoginSecurity />);
  });
  await flush();
  return renderer;
}

const texts = renderer =>
  renderer.root.findAllByType('MockText').map(n => n.props.children);

const button = (renderer, textContent) =>
  renderer.root.findAll(
    n => n.type === 'MockButton' && n.props.textContent === textContent,
  )[0];

async function press(renderer, textContent) {
  await act(async () => {
    await button(renderer, textContent).props.actionFunction();
  });
  await flush();
}

async function typeCurrentPassword(renderer, value) {
  await act(async () => {
    renderer.root.findByType('MockInput').props.setInputText(value);
  });
}

// Password wallet: pick "Use a passkey instead", confirm the current password.
async function switchToPasskey(renderer) {
  await press(renderer, 'createAccount.keySetup.passkey.createButton');
  await typeCurrentPassword(renderer, 'current password');
  await press(renderer, 'constants.continue');
}

let originalOS;
beforeEach(() => {
  jest.clearAllMocks();
  originalOS = Platform.OS;
  Platform.OS = 'web';
  mockGetStoredPasskeyInfo.mockResolvedValue(null);
  mockIsPasskeySupported.mockResolvedValue(true);
  mockDecryptWithPin.mockResolvedValue(MNEMONIC);
  mockCreatePasskey.mockResolvedValue({ status: 'ok', credentialId: 'CRED' });
  mockStoreWithPasskey.mockResolvedValue('ok');
  mockDecryptWithPasskey.mockResolvedValue(MNEMONIC);
  mockStoreWithPin.mockResolvedValue(true);
});

afterEach(() => {
  Platform.OS = originalOS;
});

describe('password wallet', () => {
  test('offers a passkey only when the browser reports PRF', async () => {
    const withPrf = await mount();
    expect(texts(withPrf)).toContain('settings.loginSecurity.passkeyCardTitle');

    mockIsPasskeySupported.mockResolvedValue(false);
    const withoutPrf = await mount();
    expect(texts(withoutPrf)).not.toContain(
      'settings.loginSecurity.passkeyCardTitle',
    );
    expect(texts(withoutPrf)).toContain(
      'settings.loginSecurity.currentPasswordSubtitle',
    );
  });

  test('current password -> create + confirm -> passkey envelope, toast, re-read', async () => {
    const renderer = await mount();
    mockGetStoredPasskeyInfo.mockResolvedValue({
      credentialId: 'CRED',
      createdAt: 1757500000000,
    });

    await switchToPasskey(renderer);

    expect(mockDecryptWithPin).toHaveBeenCalledWith(
      JSON.stringify('current password'),
    );
    expect(mockStoreWithPasskey).toHaveBeenCalledWith(MNEMONIC, 'CRED');
    expect(mockShowToast).toHaveBeenCalledWith({
      type: 'clipboard',
      title: 'settings.loginSecurity.passkeyCreated',
    });
    // Re-read: the screen now shows the passkey wallet state.
    expect(texts(renderer)).toContain('settings.loginSecurity.passkeyTitle');
  });

  test('a wrong current password never opens a passkey prompt', async () => {
    mockDecryptWithPin.mockResolvedValue(null);
    const renderer = await mount();

    await switchToPasskey(renderer);

    expect(mockCreatePasskey).not.toHaveBeenCalled();
    expect(texts(renderer)).toContain(
      'settings.loginSecurity.wrongCurrentPassword',
    );
  });

  test('confirm failed -> [Try again] reuses the same credential', async () => {
    mockStoreWithPasskey.mockResolvedValueOnce('confirm-failed');
    const renderer = await mount();

    await switchToPasskey(renderer);
    expect(texts(renderer)).toContain(
      'createAccount.keySetup.passkey.confirmFailed',
    );

    await press(renderer, 'createAccount.keySetup.passkey.tryAgain');

    expect(mockCreatePasskey).toHaveBeenCalledTimes(1);
    expect(mockStoreWithPasskey.mock.calls).toEqual([
      [MNEMONIC, 'CRED'],
      [MNEMONIC, 'CRED'],
    ]);
    expect(mockShowToast).toHaveBeenCalledTimes(1);
  });

  test('confirm failed -> [Use a password instead] forgets the new passkey', async () => {
    mockStoreWithPasskey.mockResolvedValueOnce('confirm-failed');
    const renderer = await mount();
    await switchToPasskey(renderer);

    await act(async () => {
      renderer.root
        .findByProps({ testID: 'use-password-instead' })
        .props.onPress();
    });

    expect(mockForgetPasskey).toHaveBeenCalledWith('CRED');
    expect(texts(renderer)).toContain(
      'settings.loginSecurity.currentPasswordSubtitle',
    );
  });

  test('no PRF at confirm -> passkey forgotten, unsupported message', async () => {
    mockStoreWithPasskey.mockResolvedValueOnce('unsupported');
    const renderer = await mount();

    await switchToPasskey(renderer);

    expect(mockForgetPasskey).toHaveBeenCalledWith('CRED');
    expect(texts(renderer)).toContain(
      'createAccount.keySetup.passkey.unsupported',
    );
  });

  test('a double tap on [Continue] opens only one create prompt', async () => {
    let resolveCreate;
    mockCreatePasskey.mockImplementationOnce(
      () => new Promise(resolve => (resolveCreate = resolve)),
    );
    const renderer = await mount();
    await press(renderer, 'createAccount.keySetup.passkey.createButton');
    await typeCurrentPassword(renderer, 'current password');

    const { actionFunction } = button(renderer, 'constants.continue').props;
    await act(async () => {
      actionFunction();
      actionFunction();
    });
    await act(async () => {
      resolveCreate({ status: 'ok', credentialId: 'CRED' });
    });
    await flush();

    expect(mockCreatePasskey).toHaveBeenCalledTimes(1);
    expect(mockStoreWithPasskey).toHaveBeenCalledTimes(1);
  });

  test('storage failure -> error, passkey kept, envelope re-read', async () => {
    mockStoreWithPasskey.mockResolvedValueOnce('failed');
    const renderer = await mount();
    const readsBefore = mockGetStoredPasskeyInfo.mock.calls.length;

    await switchToPasskey(renderer);

    expect(texts(renderer)).toContain(
      'settings.loginSecurity.passkeySetupFailed',
    );
    expect(mockForgetPasskey).not.toHaveBeenCalled();
    expect(mockGetStoredPasskeyInfo.mock.calls.length).toBe(readsBefore + 1);
  });
});

describe('passkey wallet', () => {
  beforeEach(() => {
    mockGetStoredPasskeyInfo.mockResolvedValue(PASSKEY_INFO);
  });

  test('shows the passkey card: title, created date, saved-as name', async () => {
    const renderer = await mount();

    expect(texts(renderer)).toEqual(
      expect.arrayContaining([
        'settings.loginSecurity.passkeyTitle',
        'settings.loginSecurity.passkeyCreatedOn',
        'settings.loginSecurity.passkeySavedAs',
      ]),
    );
    expect(
      button(renderer, 'settings.loginSecurity.switchToPassword'),
    ).toBeDefined();
    expect(texts(renderer)).not.toContain(
      'settings.loginSecurity.currentPasswordSubtitle',
    );
  });

  test('switch to password: passkey unlock -> new password -> forget the old passkey after the write', async () => {
    const renderer = await mount();
    await press(renderer, 'settings.loginSecurity.switchToPassword');

    mockGetStoredPasskeyInfo.mockResolvedValue(null);
    await act(async () => {
      await renderer.root
        .findByType('MockPasswordForm')
        .props.onSubmit('new password');
    });
    await flush();

    expect(mockStoreWithPin).toHaveBeenCalledWith(MNEMONIC, 'new password');
    expect(mockForgetPasskey).toHaveBeenCalledWith('OLD_CRED');
    expect(mockStoreWithPin.mock.invocationCallOrder[0]).toBeLessThan(
      mockForgetPasskey.mock.invocationCallOrder[0],
    );
    expect(mockShowToast).toHaveBeenCalledWith({
      type: 'success',
      title: 'settings.loginSecurity.switchedToPassword',
    });
    // Re-read: now a password wallet.
    expect(texts(renderer)).toContain(
      'settings.loginSecurity.currentPasswordSubtitle',
    );
  });

  test('a failed password write never forgets the passkey', async () => {
    mockStoreWithPin.mockResolvedValue(false);
    const renderer = await mount();
    await press(renderer, 'settings.loginSecurity.switchToPassword');

    await act(async () => {
      await renderer.root
        .findByType('MockPasswordForm')
        .props.onSubmit('new password');
    });
    await flush();

    expect(mockForgetPasskey).not.toHaveBeenCalled();
    expect(texts(renderer)).toContain(
      'settings.loginSecurity.passwordChangeFailed',
    );
  });

  test('passkey unlock cancelled -> stays put, no message', async () => {
    mockDecryptWithPasskey.mockResolvedValue(null);
    const renderer = await mount();

    await press(renderer, 'settings.loginSecurity.switchToPassword');

    expect(renderer.root.findAllByType('MockPasswordForm')).toHaveLength(0);
    expect(texts(renderer)).not.toContain('adminLogin.passkeyPage.unlockError');
  });

  test.each([
    ['fails', false],
    [
      'yields a different seed',
      'legal winner thank year wave sausage worth useful legal winner thank yellow',
    ],
  ])(
    'passkey unlock that %s -> error, no password step',
    async (_label, result) => {
      mockDecryptWithPasskey.mockResolvedValue(result);
      const renderer = await mount();

      await press(renderer, 'settings.loginSecurity.switchToPassword');

      expect(renderer.root.findAllByType('MockPasswordForm')).toHaveLength(0);
      expect(texts(renderer)).toContain('adminLogin.passkeyPage.unlockError');
    },
  );
});

test('a failed settings read offers retry without exposing password controls', async () => {
  mockGetStoredPasskeyInfo.mockRejectedValueOnce(new Error('storage offline'));
  const renderer = await mount();
  expect(texts(renderer)).toContain('settings.loginSecurity.loadError');
  expect(renderer.root.findAllByType('MockInput')).toHaveLength(0);
  mockGetStoredPasskeyInfo.mockResolvedValue(PASSKEY_INFO);
  await press(renderer, 'createAccount.keySetup.passkey.tryAgain');
  expect(texts(renderer)).toContain('settings.loginSecurity.passkeyTitle');
});

test('double tapping passkey verification opens one prompt', async () => {
  mockGetStoredPasskeyInfo.mockResolvedValue(PASSKEY_INFO);
  let resolveUnlock;
  mockDecryptWithPasskey.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveUnlock = resolve;
      }),
  );
  const renderer = await mount();
  const action = button(renderer, 'settings.loginSecurity.switchToPassword')
    .props.actionFunction;
  await act(async () => {
    action();
    action();
  });
  expect(mockDecryptWithPasskey).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveUnlock(MNEMONIC);
  });
});

test('a password write cannot run twice or be abandoned while pending', async () => {
  mockGetStoredPasskeyInfo.mockResolvedValue(PASSKEY_INFO);
  const renderer = await mount();
  await press(renderer, 'settings.loginSecurity.switchToPassword');
  let resolveWrite;
  mockStoreWithPin.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveWrite = resolve;
      }),
  );
  const submit = renderer.root.findByType('MockPasswordForm').props.onSubmit;
  await act(async () => {
    submit('new password');
    submit('another password');
  });
  const back = renderer.root.findAll(
    n => n.props.onPress && n.props.disabled === true,
  )[0];
  await act(async () => {
    back.props.onPress();
  });
  expect(renderer.root.findAllByType('MockPasswordForm')).toHaveLength(1);
  expect(mockStoreWithPin).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveWrite(false);
  });
  expect(mockForgetPasskey).not.toHaveBeenCalled();
});
