import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

// ---------------------------------------------------------------------------
// LoginSecurity settings screen: security must be one-way. Users with security
// off keep the "Enable Login Security" toggle (backwards compatibility), but
// once enabled the toggle must disappear and there must be no code path that
// switches storage back to plain.
//
// Bugs under test:
//   visible-when-off   a user with security disabled still sees the toggle.
//   no-disable-path    tapping the toggle never calls handleLoginSecuritySwitch
//                      (the 'plain' downgrade call must be gone).
//   hidden-when-on     a user with security enabled sees no toggle at all, and
//                      enabling via the PIN flow persists isSecurityEnabled:true
//                      and removes the toggle from the current render.
// ---------------------------------------------------------------------------

const mockNavigate = { navigate: jest.fn() };
const mockGetLocalStorageItem = jest.fn();
const mockSetLocalStorageItem = jest.fn();
const mockHandleLoginSecuritySwitch = jest.fn();

jest.mock('../app/constants', () => ({
  CENTER: {},
  COLORS: { darkModeText: '#fff', primary: '#00f' },
  HIDDEN_OPACITY: 0.5,
  INSET_WINDOW_WIDTH: 350,
  LOGIN_SECUITY_MODE_KEY: 'LOGIN_SECURITY_MODE',
  RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY: 'RANDOM_LOGIN_KEYBOARD_LAYOUT',
  SIZES: { small: 12, large: 20, smedium: 16 },
}));

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

jest.mock('../context-store/keys', () => ({
  useKeysContext: () => ({ accountMnemoinc: 'test mnemonic' }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigate,
}));

jest.mock('../app/functions', () => ({
  getLocalStorageItem: (...args) => mockGetLocalStorageItem(...args),
  hasHardware: jest.fn(async () => true),
  hasSavedProfile: jest.fn(async () => true),
  setLocalStorageItem: (...args) => mockSetLocalStorageItem(...args),
}));

jest.mock('../app/functions/CustomElements', () => ({
  ThemeText: props => {
    const R = require('react');
    return R.createElement('MockText', { ...props, children: props.content });
  },
}));

jest.mock('../app/functions/CustomElements/switch', () => ({
  __esModule: true,
  default: props => {
    const R = require('react');
    return R.createElement('MockToggleSwitch', props);
  },
}));

jest.mock('../app/functions/CustomElements/checkMarkCircle', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/themeIcon', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/loadingScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/noContentScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/handleMnemonic', () => ({
  handleLoginSecuritySwitch: (...args) =>
    mockHandleLoginSecuritySwitch(...args),
}));

jest.mock('../app/hooks/themeColors', () => ({
  __esModule: true,
  default: () => ({ backgroundOffset: '#111', backgroundColor: '#222' }),
}));

const LoginSecurity =
  require('../app/components/admin/homeComponents/settingsContent/loginSecurity')
    .default;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOGIN_SECURITY_MODE_KEY = 'LOGIN_SECURITY_MODE';
const RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY = 'RANDOM_LOGIN_KEYBOARD_LAYOUT';

function mockStoredState(settings) {
  mockGetLocalStorageItem.mockImplementation(key => {
    if (key === LOGIN_SECURITY_MODE_KEY)
      return Promise.resolve(JSON.stringify(settings));
    if (key === RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY)
      return Promise.resolve(JSON.stringify(false));
    return Promise.resolve(null);
  });
}

async function mount(extraData) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<LoginSecurity extraData={extraData} />);
  });
  return renderer;
}

// Flush the chained microtasks of the async load/save flows.
async function flush() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function loginSecurityToggle(renderer) {
  return renderer.root.findByProps({ page: 'LoginSecurityMode' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders the enable toggle when security is disabled', async () => {
  mockStoredState({
    isSecurityEnabled: false,
    isPinEnabled: false,
    isBiometricEnabled: false,
  });

  const renderer = await mount();
  await flush();

  const toggleSwitch = loginSecurityToggle(renderer);
  expect(toggleSwitch.props.stateValue).toBe(false);
});

it('hides the toggle entirely when security is enabled', async () => {
  mockStoredState({
    isSecurityEnabled: true,
    isPinEnabled: true,
    isBiometricEnabled: false,
  });

  const renderer = await mount();
  await flush();

  expect(
    renderer.root.findAllByProps({ page: 'LoginSecurityMode' }),
  ).toHaveLength(0);
});

it('tapping the toggle only reveals the security choice and never disables security', async () => {
  mockStoredState({
    isSecurityEnabled: false,
    isPinEnabled: false,
    isBiometricEnabled: false,
  });

  const renderer = await mount();
  await flush();

  await act(async () => {
    loginSecurityToggle(renderer).props.toggleSwitchFunction();
  });

  expect(mockHandleLoginSecuritySwitch).not.toHaveBeenCalled();
  expect(
    renderer.root.findAllByProps({ children: 'settings.loginSecurity.text2' }),
  ).toHaveLength(1);
});

it('enabling via the PIN flow persists the new state and removes the toggle', async () => {
  mockStoredState({
    isSecurityEnabled: false,
    isPinEnabled: false,
    isBiometricEnabled: false,
  });
  mockHandleLoginSecuritySwitch.mockResolvedValue(true);

  const renderer = await mount();
  await flush();
  expect(loginSecurityToggle(renderer).props.stateValue).toBe(false);

  await act(async () => {
    renderer.update(<LoginSecurity extraData={{ pin: '1234' }} />);
  });
  await flush();

  expect(mockHandleLoginSecuritySwitch).toHaveBeenCalledWith(
    'test mnemonic',
    '1234',
    'pin',
  );
  expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
    LOGIN_SECURITY_MODE_KEY,
    JSON.stringify({
      isSecurityEnabled: true,
      isPinEnabled: true,
      isBiometricEnabled: false,
    }),
  );
  expect(
    renderer.root.findAllByProps({ page: 'LoginSecurityMode' }),
  ).toHaveLength(0);
});
