/* eslint-env jest */
// PinSetup onboarding gate: after the keychain write succeeds, wipeLocalWalletData
// must run BEFORE didViewSeedPhrase is written and BEFORE navigation. A wipe
// failure must route to ErrorScreen with a retry navigator and never continue
// into the loading screen ("no continue anyway").

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockNavigate = { navigate: jest.fn(), reset: jest.fn() };
const mockStoreMnemonic = jest.fn();
const mockWipe = jest.fn();
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

jest.mock('../app/functions/wipeLocalWalletData', () => ({
  __esModule: true,
  default: (...args) => mockWipe(...args),
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
    currentRenderer = ReactTestRenderer.create(
      <PinPage route={{ params }} />,
    );
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

describe('PinPage onboarding wipe gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreMnemonic.mockResolvedValue(true);
    mockWipe.mockResolvedValue(true);
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

  test('wipes after the keychain write, before didViewSeedPhrase and navigation', async () => {
    mockWipe.mockImplementation(async () => {
      expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
      expect(mockNavigate.reset).not.toHaveBeenCalled();
      return true;
    });

    mount();
    await enterPin(CREATE_PIN);
    await enterPin(CONFIRM_PIN);
    await flush();

    expect(mockStoreMnemonic).toHaveBeenCalledTimes(1);
    expect(mockWipe).toHaveBeenCalledTimes(1);
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      'didViewSeedPhrase',
      'false',
    );
    expect(mockNavigate.navigate).not.toHaveBeenCalled();
    expect(mockNavigate.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [
        {
          name: 'ConnectingToNodeLoadingScreen',
          params: { expectedMnemonicHash: 'HASHED' },
        },
      ],
    });
  });

  test('restore onboarding writes didViewSeedPhrase true', async () => {
    mount({ didRestoreWallet: true });
    await enterPin(CREATE_PIN);
    await enterPin(CONFIRM_PIN);
    await flush();

    expect(mockWipe).toHaveBeenCalledTimes(1);
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      'didViewSeedPhrase',
      'true',
    );
    expect(mockNavigate.reset).toHaveBeenCalledTimes(1);
  });

  test('a second PIN entry during the wipe cannot re-enter the flow', async () => {
    let resolveWipe;
    mockWipe.mockImplementation(
      () => new Promise(resolve => (resolveWipe = resolve)),
    );

    mount();
    await enterPin(CREATE_PIN);
    await enterPin(CONFIRM_PIN);

    // While the wipe is still in flight, enter another full PIN.
    await enterPin(CREATE_PIN);

    await act(async () => {
      resolveWipe(true);
      await Promise.resolve();
    });
    await flush();

    expect(mockWipe).toHaveBeenCalledTimes(1);
    expect(mockStoreMnemonic).toHaveBeenCalledTimes(1);
    expect(mockNavigate.reset).toHaveBeenCalledTimes(1);
  });

  test('a wipe failure routes to ErrorScreen and never navigates to the loading screen', async () => {
    mockWipe.mockResolvedValue(false);

    mount();
    await enterPin(CREATE_PIN);
    await enterPin(CONFIRM_PIN);
    await flush();

    expect(mockNavigate.navigate).toHaveBeenCalledWith(
      'ErrorScreen',
      expect.objectContaining({
        errorMessage: 'createAccount.keySetup.pin.wipeError',
      }),
    );
    expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
    expect(mockNavigate.reset).not.toHaveBeenCalled();
  });

  test('the wipe error retry navigator completes onboarding when retry succeeds', async () => {
    mockWipe.mockResolvedValue(false);

    mount();
    await enterPin(CREATE_PIN);
    await enterPin(CONFIRM_PIN);
    await flush();

    const { customNavigator } = mockNavigate.navigate.mock.calls[0][1];
    expect(customNavigator).toEqual(expect.any(Function));

    mockWipe.mockResolvedValue(true);
    await act(async () => {
      await customNavigator();
    });
    await flush();

    expect(mockWipe).toHaveBeenCalledTimes(2);
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      'didViewSeedPhrase',
      'false',
    );
    expect(mockNavigate.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [
        {
          name: 'ConnectingToNodeLoadingScreen',
          params: { expectedMnemonicHash: 'HASHED' },
        },
      ],
    });
  });

  test('the wipe error retry navigator stays put when retry fails again', async () => {
    mockWipe.mockResolvedValue(false);

    mount();
    await enterPin(CREATE_PIN);
    await enterPin(CONFIRM_PIN);
    await flush();

    const { customNavigator } = mockNavigate.navigate.mock.calls[0][1];

    await act(async () => {
      await customNavigator();
    });
    await flush();

    expect(mockWipe).toHaveBeenCalledTimes(2);
    expect(mockNavigate.reset).not.toHaveBeenCalled();
    expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
  });
});
