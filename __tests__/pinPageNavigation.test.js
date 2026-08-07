/* eslint-env jest */
// PinSetup onboarding nav: after the keychain write succeeds, PinPage writes
// didViewSeedPhrase and resets into the loading screen with shouldWipeLocalData
// (the wipe itself now runs on the loading screen, not here). A keychain-write
// failure routes to ErrorScreen and never navigates on.

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockNavigate = { navigate: jest.fn(), reset: jest.fn() };
const mockStoreMnemonic = jest.fn();
const mockSetLocalStorageItem = jest.fn();
const mockFactoryReset = jest.fn();
const mockPrivateKeyFromSeedWords = jest.fn();
const mockInitializeFirebase = jest.fn();

jest.mock('../app/constants', () => ({
  SIZES: { xLarge: 30, large: 20, medium: 16 },
}));

jest.mock('../app/functions/CustomElements', () => ({
  GlobalThemeView: ({ children }) => children,
  ThemeText: () => null,
}));

jest.mock('../app/functions/CustomElements/key', () => ({
  __esModule: true,
  default: props => {
    const R = require('react');
    return R.createElement('MockKey', props);
  },
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

jest.mock('../app/functions', () => ({
  setLocalStorageItem: (...args) => mockSetLocalStorageItem(...args),
}));

jest.mock('../app/functions/handleMnemonic', () => ({
  storeMnemonicWithPinSecurity: (...args) => mockStoreMnemonic(...args),
}));

jest.mock('../app/functions/factoryResetWallet', () => ({
  __esModule: true,
  default: (...args) => mockFactoryReset(...args),
}));

jest.mock('react-native-restart-newarch', () => ({
  __esModule: true,
  default: { restart: jest.fn() },
}));

jest.mock('../app/functions/nostrCompatability', () => ({
  privateKeyFromSeedWords: (...args) => mockPrivateKeyFromSeedWords(...args),
}));

jest.mock('nostr-tools', () => ({ getPublicKey: () => 'pubkey' }));

jest.mock('../db/initializeFirebase', () => ({
  initializeFirebase: (...args) => mockInitializeFirebase(...args),
}));

jest.mock('../app/functions/hash', () => ({
  __esModule: true,
  default: () => 'HASHED',
}));

const PinPage = require('../app/screens/createAccount/keySetup/pin').default;

let currentRenderer;

function mount(params = {}) {
  act(() => {
    currentRenderer = ReactTestRenderer.create(<PinPage route={{ params }} />);
  });
  return currentRenderer;
}

// Enter one digit through the most recent key component (fresh addPin closure).
function enterDigit(num) {
  const keys = currentRenderer.root.findAllByType('MockKey');
  const key = keys.find(k => k.props.num === num);
  act(() => {
    key.props.addPin(num);
  });
}

async function enterPin(digits) {
  for (const digit of digits) {
    enterDigit(digit);
    await act(async () => {});
  }
}

async function flush() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const CREATE_PIN = [1, 2, 3, 4];
const CONFIRM_PIN = [1, 2, 3, 4];

const EXPECTED_ROUTES = [
  {
    name: 'ConnectingToNodeLoadingScreen',
    params: { shouldWipeLocalData: true, expectedMnemonicHash: 'HASHED' },
  },
];

describe('PinPage onboarding navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreMnemonic.mockResolvedValue(true);
    mockSetLocalStorageItem.mockResolvedValue(true);
    mockPrivateKeyFromSeedWords.mockResolvedValue('privkey');
    mockInitializeFirebase.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (currentRenderer) {
      act(() => currentRenderer.unmount());
      currentRenderer = null;
    }
  });

  test('create: writes didViewSeedPhrase false then resets with shouldWipeLocalData', async () => {
    mount();
    await enterPin(CREATE_PIN);
    await enterPin(CONFIRM_PIN);
    await flush();

    expect(mockStoreMnemonic).toHaveBeenCalledTimes(1);
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      'didViewSeedPhrase',
      'false',
    );
    expect(mockNavigate.navigate).not.toHaveBeenCalled();
    expect(mockNavigate.reset).toHaveBeenCalledWith({
      index: 0,
      routes: EXPECTED_ROUTES,
    });
  });

  test('restore onboarding writes didViewSeedPhrase true', async () => {
    mount({ didRestoreWallet: true });
    await enterPin(CREATE_PIN);
    await enterPin(CONFIRM_PIN);
    await flush();

    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      'didViewSeedPhrase',
      'true',
    );
    expect(mockNavigate.reset).toHaveBeenCalledTimes(1);
  });

  test('a second PIN entry during the keychain write cannot re-enter the flow', async () => {
    let resolveStore;
    mockStoreMnemonic.mockImplementation(
      () => new Promise(resolve => (resolveStore = resolve)),
    );

    mount();
    await enterPin(CREATE_PIN);
    await enterPin(CONFIRM_PIN);

    // While the keychain write is still in flight, enter another full PIN.
    await enterPin(CREATE_PIN);

    await act(async () => {
      resolveStore(true);
      await Promise.resolve();
    });
    await flush();

    expect(mockStoreMnemonic).toHaveBeenCalledTimes(1);
    expect(mockNavigate.reset).toHaveBeenCalledTimes(1);
  });

  test('a keychain-write failure routes to ErrorScreen and never navigates on', async () => {
    mockStoreMnemonic.mockResolvedValue(false);

    mount();
    await enterPin(CREATE_PIN);
    await enterPin(CONFIRM_PIN);
    await flush();

    expect(mockNavigate.navigate).toHaveBeenCalledWith(
      'ErrorScreen',
      expect.objectContaining({
        errorMessage: 'createAccount.keySetup.pin.savePinError',
      }),
    );
    expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
    expect(mockNavigate.reset).not.toHaveBeenCalled();
  });
});
