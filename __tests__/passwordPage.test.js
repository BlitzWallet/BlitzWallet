import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Web PasswordPage stale-tab guard. A wallet switched to a passkey in another
// tab can't be opened by any password, so a "wrong password" there must never
// count toward the 8-attempt auto-reset (which would wipe the wallet): the
// page reloads instead, and the reload opens the passkey login.
// ---------------------------------------------------------------------------

const mockNavigate = { navigate: jest.fn(), replace: jest.fn() };
const mockGetLocalStorageItem = jest.fn();
const mockSetLocalStorageItem = jest.fn();
const mockDecryptWithPin = jest.fn();
const mockGetStoredPasskeyInfo = jest.fn();
const mockFactoryReset = jest.fn();

jest.mock('../app/constants', () => ({
  CENTER: {},
  COLORS: { gray: '#888', cancelRed: '#f00' },
  PERSISTED_LOGIN_COUNT_KEY: 'PERSISTED_LOGIN_COUNT_KEY',
  SIZES: { xxLarge: 30, smedium: 16, small: 12 },
}));

jest.mock('../app/functions', () => ({
  getLocalStorageItem: (...args) => mockGetLocalStorageItem(...args),
  setLocalStorageItem: (...args) => mockSetLocalStorageItem(...args),
}));

jest.mock('../app/functions/CustomElements', () => ({
  ThemeText: () => null,
}));

jest.mock('../app/functions/CustomElements/searchInput', () => ({
  __esModule: true,
  default: props => require('react').createElement('MockInput', props),
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
  useKeysContext: () => ({ setAccountMnemonic: jest.fn() }),
}));

jest.mock('../app/functions/handleMnemonic', () => ({
  decryptMnemonicWithPin: (...args) => mockDecryptWithPin(...args),
}));

jest.mock('../app/functions/passkeyMnemonic', () => ({
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

jest.mock('react-native-restart-newarch', () => ({
  __esModule: true,
  default: { restart: jest.fn() },
}));

const PasswordPage =
  require('../app/components/admin/loginComponents/passwordPage').default;

async function flush() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function mountWithAttempts(persistedAttempts) {
  mockGetLocalStorageItem.mockResolvedValue(JSON.stringify(persistedAttempts));
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<PasswordPage />);
  });
  await flush();
  return renderer;
}

async function submitWrongPassword(renderer) {
  await act(async () => {
    renderer.root.findByType('MockInput').props.setInputText('wrong');
  });
  await act(async () => {
    await renderer.root.findByType('MockButton').props.actionFunction();
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDecryptWithPin.mockResolvedValue(null); // every password is wrong
  mockFactoryReset.mockResolvedValue(true);
  global.location = { reload: jest.fn() };
});

afterEach(() => {
  delete global.location;
});

test('on a wallet switched to a passkey, a wrong password reloads and is never counted', async () => {
  mockGetStoredPasskeyInfo.mockResolvedValue({
    credentialId: 'Y3JlZA',
    createdAt: 1757500000000,
  });
  // 7 prior attempts: one more counted attempt would factory-reset.
  const renderer = await mountWithAttempts(7);

  await submitWrongPassword(renderer);

  expect(global.location.reload).toHaveBeenCalledTimes(1);
  expect(mockFactoryReset).not.toHaveBeenCalled();
  expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
});

test('on a password wallet, a wrong password is still counted', async () => {
  mockGetStoredPasskeyInfo.mockResolvedValue(null);
  const renderer = await mountWithAttempts(0);

  await submitWrongPassword(renderer);

  expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
    'PERSISTED_LOGIN_COUNT_KEY',
    '1',
  );
  expect(global.location.reload).not.toHaveBeenCalled();
});

test('on a password wallet, the 8th wrong password still auto-resets', async () => {
  mockGetStoredPasskeyInfo.mockResolvedValue(null);
  const renderer = await mountWithAttempts(7);

  await submitWrongPassword(renderer);

  expect(mockFactoryReset).toHaveBeenCalledTimes(1);
});

test('unreadable storage never counts an attempt or resets the wallet', async () => {
  mockGetStoredPasskeyInfo.mockRejectedValueOnce(
    new Error('storage unavailable'),
  );
  const renderer = await mountWithAttempts(7);
  await submitWrongPassword(renderer);
  expect(mockFactoryReset).not.toHaveBeenCalled();
  expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
  expect(global.location.reload).not.toHaveBeenCalled();
});
