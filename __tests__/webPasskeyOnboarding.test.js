/* eslint-env jest */
// Web onboarding (createAccount/keySetup/pin.js → WebCreatePassword): the
// passkey offer step shown when the browser reports PRF, and its fallbacks to
// the password form. Covers the design's failure table: cancel stays put, an
// unsupported provider falls back with an explanation, a failed confirm
// retries on the SAME credential, an abandoned passkey is forgotten, and a
// storage failure takes the existing savePinError path.

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';

const mockNavigate = { navigate: jest.fn(), reset: jest.fn() };
const mockSetLocalStorageItem = jest.fn();
const mockStoreWithPin = jest.fn();
const mockIsPasskeySupported = jest.fn();
const mockCreatePasskey = jest.fn();
const mockStoreWithPasskey = jest.fn();
const mockForgetPasskey = jest.fn();
let mockRouteParams = {};

jest.mock('../app/constants', () => ({
  CENTER: {},
  COLORS: { primary: '#000', darkModeText: '#fff', lightModeText: '#000' },
  FONT: {},
  ICONS: {},
  SIZES: { xLarge: 30, large: 20, smedium: 16, small: 12 },
}));

jest.mock('../app/functions/CustomElements', () => ({
  GlobalThemeView: ({ children }) => children ?? null,
  ThemeText: props =>
    require('react').createElement('MockText', { children: props.content }),
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

jest.mock('../app/functions/CustomElements/key', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/pinDot', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

jest.mock('../context-store/keys', () => ({
  useKeysContext: () => ({ accountMnemoinc: 'seed words' }),
}));

// settingsTopBar reads screen size + theme; the real providers pull native
// modules (expo-network, ...) that don't exist under Jest.
jest.mock('../context-store/appStatus', () => ({
  useAppStatus: () => ({ screenDimensions: { width: 400, height: 800 } }),
}));

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

jest.mock('../app/functions', () => ({
  setLocalStorageItem: (...args) => mockSetLocalStorageItem(...args),
}));

jest.mock('../app/functions/handleMnemonic', () => ({
  storeMnemonicWithPinSecurity: (...args) => mockStoreWithPin(...args),
}));

jest.mock('../app/functions/passkeyMnemonic', () => ({
  isPasskeySupported: (...args) => mockIsPasskeySupported(...args),
  createPasskey: (...args) => mockCreatePasskey(...args),
  storeMnemonicWithPasskey: (...args) => mockStoreWithPasskey(...args),
  forgetPasskey: (...args) => mockForgetPasskey(...args),
}));

jest.mock('../app/functions/factoryResetWallet', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('react-native-restart-newarch', () => ({
  __esModule: true,
  default: { restart: jest.fn() },
}));

jest.mock('../app/functions/nostrCompatability', () => ({
  privateKeyFromSeedWords: jest.fn(async () => null),
}));

jest.mock('nostr-tools', () => ({ getPublicKey: () => 'pubkey' }));

jest.mock('../db/initializeFirebase', () => ({
  initializeFirebase: jest.fn(),
}));

jest.mock('../app/functions/hash', () => ({
  __esModule: true,
  default: str => `HASH(${str})`,
}));

// settingsTopBar -> themeImage -> expo-image, and the theme context ->
// functions/index -> secureStore, all touch native modules under Jest.
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

// theme context -> functions/index -> biometricAuthentication touches the
// expo-local-authentication native module, which doesn't exist under Jest.
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
  authenticateAsync: jest.fn(async () => ({ success: false })),
}));

jest.mock('../app/functions/customNavigation', () => ({
  keyboardGoBack: jest.fn(async () => {}),
}));

// settingsTopBar -> themeImage renders an expo-image, a native module that
// doesn't exist under Jest.
jest.mock('expo-image', () => ({
  Image: () => null,
}));

const PinPage = require('../app/screens/createAccount/keySetup/pin').default;

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
    renderer = ReactTestRenderer.create(
      <PinPage route={{ params: mockRouteParams }} />,
    );
  });
  await flush();
  return renderer;
}

async function press(renderer) {
  await act(async () => {
    await renderer.root.findByType('MockButton').props.actionFunction();
  });
  await flush();
}

async function usePasswordInstead(renderer) {
  await act(async () => {
    renderer.root
      .findByProps({ testID: 'use-password-instead' })
      .props.onPress();
  });
  await flush();
}

const texts = renderer =>
  renderer.root.findAllByType('MockText').map(n => n.props.children);
const passwordForm = renderer =>
  renderer.root.findAllByType('MockPasswordForm')[0];

const EXPECTED_RESET = {
  index: 0,
  routes: [
    {
      name: 'ConnectingToNodeLoadingScreen',
      params: {
        shouldWipeLocalData: true,
        expectedMnemonicHash: 'HASH(seed words)',
      },
    },
  ],
};

let originalOS;
beforeEach(() => {
  jest.clearAllMocks();
  originalOS = Platform.OS;
  Platform.OS = 'web';
  mockRouteParams = {};
  mockIsPasskeySupported.mockResolvedValue(true);
  mockCreatePasskey.mockResolvedValue({ status: 'ok', credentialId: 'CRED' });
  mockStoreWithPasskey.mockResolvedValue('ok');
  mockStoreWithPin.mockResolvedValue(true);
});

afterEach(() => {
  Platform.OS = originalOS;
});

test('a browser without PRF gets the password form directly', async () => {
  mockIsPasskeySupported.mockResolvedValue(false);
  const renderer = await mount();

  expect(passwordForm(renderer)).toBeDefined();
  expect(passwordForm(renderer).props.subtitleText).toBe(
    'createAccount.keySetup.password.createSubtitle',
  );
  expect(texts(renderer)).not.toContain(
    'createAccount.keySetup.passkey.offerHeader',
  );
});

test('the password path still stores the envelope and resets into the wiping loading screen', async () => {
  mockIsPasskeySupported.mockResolvedValue(false);
  const renderer = await mount();

  await act(async () => {
    await passwordForm(renderer).props.onSubmit('correct horse');
  });

  expect(mockStoreWithPin).toHaveBeenCalledWith('seed words', 'correct horse');
  expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
    'didViewSeedPhrase',
    'false',
  );
  expect(mockNavigate.reset).toHaveBeenCalledWith(EXPECTED_RESET);
});

test('create + confirm -> same reset as the password path', async () => {
  const renderer = await mount();
  expect(texts(renderer)).toContain(
    'createAccount.keySetup.passkey.offerHeader',
  );

  await press(renderer);

  expect(mockStoreWithPasskey).toHaveBeenCalledWith('seed words', 'CRED');
  expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
    'didViewSeedPhrase',
    'false',
  );
  expect(mockNavigate.reset).toHaveBeenCalledWith(EXPECTED_RESET);
  expect(mockStoreWithPin).not.toHaveBeenCalled();
});

test('restore pins the loading screen to the typed seed hash', async () => {
  mockRouteParams = {
    didRestoreWallet: true,
    expectedMnemonicHash: 'RESTORE_HASH',
  };
  const renderer = await mount();

  await press(renderer);

  expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
    'didViewSeedPhrase',
    'true',
  );
  expect(
    mockNavigate.reset.mock.calls[0][0].routes[0].params.expectedMnemonicHash,
  ).toBe('RESTORE_HASH');
});

test('closing the create prompt stays on the step with no error', async () => {
  mockCreatePasskey.mockResolvedValue({ status: 'cancelled' });
  const renderer = await mount();

  await press(renderer);

  expect(texts(renderer)).toContain(
    'createAccount.keySetup.passkey.offerHeader',
  );
  expect(texts(renderer)).not.toContain(
    'createAccount.keySetup.passkey.confirmFailed',
  );
  expect(mockStoreWithPasskey).not.toHaveBeenCalled();
  expect(mockNavigate.reset).not.toHaveBeenCalled();
});

test('create() unsupported -> password form that says why', async () => {
  mockCreatePasskey.mockResolvedValue({ status: 'unsupported' });
  const renderer = await mount();

  await press(renderer);

  expect(passwordForm(renderer).props.subtitleText).toBe(
    'createAccount.keySetup.passkey.unsupported',
  );
});

test('confirm failed -> [Try again] retries on the same credential, never a second passkey', async () => {
  mockStoreWithPasskey.mockResolvedValueOnce('confirm-failed');
  const renderer = await mount();

  await press(renderer);
  expect(texts(renderer)).toContain(
    'createAccount.keySetup.passkey.confirmFailed',
  );
  expect(renderer.root.findByType('MockButton').props.textContent).toBe(
    'createAccount.keySetup.passkey.tryAgain',
  );

  await press(renderer);

  expect(mockCreatePasskey).toHaveBeenCalledTimes(1);
  expect(mockStoreWithPasskey).toHaveBeenCalledTimes(2);
  expect(mockStoreWithPasskey.mock.calls[1]).toEqual(['seed words', 'CRED']);
  expect(mockNavigate.reset).toHaveBeenCalledWith(EXPECTED_RESET);
});

test('confirm failed -> [Use a password instead] forgets the passkey', async () => {
  mockStoreWithPasskey.mockResolvedValueOnce('confirm-failed');
  const renderer = await mount();
  await press(renderer);

  await usePasswordInstead(renderer);

  expect(mockForgetPasskey).toHaveBeenCalledWith('CRED');
  expect(passwordForm(renderer).props.subtitleText).toBe(
    'createAccount.keySetup.password.createSubtitle',
  );
});

test('no PRF at confirm -> passkey forgotten, password form says why', async () => {
  mockStoreWithPasskey.mockResolvedValueOnce('unsupported');
  const renderer = await mount();

  await press(renderer);

  expect(mockForgetPasskey).toHaveBeenCalledWith('CRED');
  expect(passwordForm(renderer).props.subtitleText).toBe(
    'createAccount.keySetup.passkey.unsupported',
  );
});

test('storage failure -> savePinError screen, passkey kept', async () => {
  mockStoreWithPasskey.mockResolvedValueOnce('failed');
  const renderer = await mount();

  await press(renderer);

  expect(mockNavigate.navigate).toHaveBeenCalledWith(
    'ErrorScreen',
    expect.objectContaining({
      errorMessage: 'createAccount.keySetup.pin.savePinError',
    }),
  );
  expect(mockNavigate.reset).not.toHaveBeenCalled();
  expect(mockForgetPasskey).not.toHaveBeenCalled();
});

test('[Use a password instead] before creating anything opens the form, nothing to forget', async () => {
  const renderer = await mount();

  await usePasswordInstead(renderer);

  expect(passwordForm(renderer)).toBeDefined();
  expect(mockCreatePasskey).not.toHaveBeenCalled();
  expect(mockForgetPasskey).not.toHaveBeenCalled();
});

test('a double tap opens only one create prompt', async () => {
  let resolveCreate;
  mockCreatePasskey.mockImplementationOnce(
    () => new Promise(resolve => (resolveCreate = resolve)),
  );
  const renderer = await mount();

  const { actionFunction } = renderer.root.findByType('MockButton').props;
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

test('password fallback cannot race an outstanding passkey prompt', async () => {
  let resolveCreate;
  mockCreatePasskey.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveCreate = resolve;
      }),
  );
  const renderer = await mount();
  await act(async () => {
    renderer.root.findByType('MockButton').props.actionFunction();
  });
  await usePasswordInstead(renderer);
  expect(passwordForm(renderer)).toBeUndefined();
  await act(async () => {
    resolveCreate({ status: 'ok', credentialId: 'CRED' });
  });
  expect(mockNavigate.reset).toHaveBeenCalledWith(EXPECTED_RESET);
});

test('password storage rejects duplicate submissions and handles thrown failure', async () => {
  mockIsPasskeySupported.mockResolvedValue(false);
  let rejectWrite;
  mockStoreWithPin.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectWrite = reject;
      }),
  );
  const renderer = await mount();
  const submit = passwordForm(renderer).props.onSubmit;
  await act(async () => {
    submit('password');
    submit('other password');
  });
  expect(mockStoreWithPin).toHaveBeenCalledTimes(1);
  await act(async () => {
    rejectWrite(new Error('storage unavailable'));
  });
  expect(mockNavigate.navigate).toHaveBeenCalledWith(
    'ErrorScreen',
    expect.objectContaining({
      errorMessage: 'createAccount.keySetup.pin.savePinError',
    }),
  );
});

test('an uncertain passkey write is not forgotten until password replacement succeeds', async () => {
  mockStoreWithPasskey.mockResolvedValueOnce('failed');
  const renderer = await mount();
  await press(renderer);
  await usePasswordInstead(renderer);
  expect(mockForgetPasskey).not.toHaveBeenCalled();
  mockStoreWithPin.mockResolvedValueOnce(false);
  await act(async () => {
    await passwordForm(renderer).props.onSubmit('password');
  });
  expect(mockForgetPasskey).not.toHaveBeenCalled();
  await act(async () => {
    await passwordForm(renderer).props.onSubmit('password');
  });
  expect(mockForgetPasskey).toHaveBeenCalledWith('CRED');
});
