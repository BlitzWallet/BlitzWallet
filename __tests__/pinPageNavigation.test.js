/* eslint-env jest */
// PinPage navigation tests:
//  - Onboarding (createAccount/keySetup/pin): after the keychain write
//    succeeds, PinPage writes didViewSeedPhrase and resets into the loading
//    screen with shouldWipeLocalData (the wipe itself now runs on the loading
//    screen, not here). A keychain-write failure routes to ErrorScreen and
//    never navigates on.
//  - Login resume (components/admin/loginComponents/pinPage): the
//    needsToBeMigrated branch must dispatch by exact format — encrypted
//    (v2/v3/EvpKDF) values go down the decrypt path (never re-encrypted as a
//    seed), plaintext seeds require the sha256 raw-PIN gate (B1) before the
//    handleLoginSecuritySwitch migration, and keychain glitches / garbage fall
//    through to handleWrongPin.

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockNavigate = { navigate: jest.fn(), reset: jest.fn(), replace: jest.fn() };
const mockStoreMnemonic = jest.fn();
const mockSetLocalStorageItem = jest.fn();
const mockGetLocalStorageItem = jest.fn();
const mockRetrieveData = jest.fn();
const mockFactoryReset = jest.fn();
const mockPrivateKeyFromSeedWords = jest.fn();
const mockInitializeFirebase = jest.fn();
const mockDecryptWithPin = jest.fn();
const mockLoginSecuritySwitch = jest.fn();
const mockSetAccountMnemonic = jest.fn();

jest.mock('../app/constants', () => ({
  SIZES: { xLarge: 30, large: 20, medium: 16 },
  LOGIN_SECUITY_MODE_KEY: 'LOGIN_SECURITY_MODE',
  PERSISTED_LOGIN_COUNT_KEY: 'PERSISTED_LOGIN_COUNT_KEY',
  RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY: 'RANDOM_KEYBOARD_LAYOUT_KEY',
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
  useKeysContext: () => ({
    accountMnemoinc: 'seed words',
    setAccountMnemonic: (...args) => mockSetAccountMnemonic(...args),
  }),
}));

jest.mock('../app/functions', () => ({
  setLocalStorageItem: (...args) => mockSetLocalStorageItem(...args),
  getLocalStorageItem: (...args) => mockGetLocalStorageItem(...args),
  retrieveData: (...args) => mockRetrieveData(...args),
}));

// Real detection helpers + mocked crypto entry points. requireActual needs the
// module graph (secureStore/localStorage/crashlytics/expo-secure-store) stubbed.
jest.mock('../app/functions/secureStore', () => ({
  MIGRATION_FLAG: 'secureStoreMigrationComplete',
  SECURE_MIGRATION_V2_FLAG: 'secureStoreMigrationV2Complete',
  storeData: jest.fn(),
  retrieveData: jest.fn(),
  deleteItem: jest.fn(),
}));

jest.mock('../app/functions/localStorage', () => ({
  setLocalStorageItem: (...args) => mockSetLocalStorageItem(...args),
  getLocalStorageItem: (...args) => mockGetLocalStorageItem(...args),
  removeLocalStorageItem: jest.fn(),
}));

jest.mock('../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({ deleteItemAsync: jest.fn() }));

jest.mock('../app/functions/handleMnemonic', () => {
  const actual = jest.requireActual('../app/functions/handleMnemonic');
  return {
    ...actual,
    storeMnemonicWithPinSecurity: (...args) => mockStoreMnemonic(...args),
    decryptMnemonicWithPin: (...args) => mockDecryptWithPin(...args),
    handleLoginSecuritySwitch: (...args) => mockLoginSecuritySwitch(...args),
  };
});

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
  default: str => `HASH(${str})`,
}));

const OnboardingPinPage = require('../app/screens/createAccount/keySetup/pin').default;
const LoginPinPage = require('../app/components/admin/loginComponents/pinPage').default;

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

let currentRenderer;

function mount(Component, params = {}) {
  act(() => {
    currentRenderer = ReactTestRenderer.create(
      <Component route={{ params }} />,
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
    mount(OnboardingPinPage);
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
      routes: [
        {
          name: 'ConnectingToNodeLoadingScreen',
          params: { shouldWipeLocalData: true, expectedMnemonicHash: 'HASH(seed words)' },
        },
      ],
    });
  });

  test('restore onboarding writes didViewSeedPhrase true', async () => {
    mount(OnboardingPinPage, { didRestoreWallet: true });
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

    mount(OnboardingPinPage);
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

    mount(OnboardingPinPage);
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

describe('Login PinPage resume branch (needsToBeMigrated)', () => {
  const SECURITY_SETTINGS = JSON.stringify({
    isSecurityEnabled: true,
    isPinEnabled: true,
    isBiometricEnabled: false,
  });
  const RAW_PIN_JSON = '[1,2,3,4]';

  function forgeCiphertext(version) {
    if (version === 'v3') {
      return JSON.stringify({
        v: 3,
        alg: 'aes-256-gcm',
        kdf: 'argon2id',
        salt: '00'.repeat(16),
        m: 19456,
        t: 2,
        p: 1,
        iv: Buffer.alloc(12).toString('base64'),
        tag: Buffer.alloc(16).toString('base64'),
        ct: Buffer.from('ciphertext').toString('base64'),
      });
    }
    if (version === 'v2') {
      return JSON.stringify({
        v: 2,
        salt: '00'.repeat(16),
        iv: Buffer.alloc(16).toString('hex'),
        ct: Buffer.from('ciphertext').toString('base64'),
      });
    }
    return 'U2FsdGVkX1+c2ltdWxhdGVkLWxlZ2FjeS1jaXBoZXJ0ZXh0';
  }

  function installLoginState({ encryptedMnemonic, pinHash = RAW_PIN_JSON }) {
    mockGetLocalStorageItem.mockImplementation(key => {
      if (key === 'LOGIN_SECURITY_MODE')
        return Promise.resolve(SECURITY_SETTINGS);
      if (key === 'RANDOM_KEYBOARD_LAYOUT_KEY') return Promise.resolve('false');
      if (key === 'PERSISTED_LOGIN_COUNT_KEY') return Promise.resolve('0');
      return Promise.resolve(null);
    });
    mockRetrieveData.mockImplementation(key => {
      if (key === 'pinHash')
        return Promise.resolve({ didWork: true, value: pinHash });
      if (key === 'encryptedMnemonic')
        return Promise.resolve({ didWork: true, value: encryptedMnemonic });
      return Promise.resolve({ didWork: false, value: null });
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetLocalStorageItem.mockResolvedValue(true);
    mockDecryptWithPin.mockReset();
    mockLoginSecuritySwitch.mockReset();
  });

  afterEach(() => {
    if (currentRenderer) {
      act(() => currentRenderer.unmount());
      currentRenderer = null;
    }
  });

  it.each(['v2', 'v3', 'evpkdf'])(
    '%s ciphertext takes the decrypt path (no re-encrypt-as-seed)',
    async version => {
      installLoginState({ encryptedMnemonic: forgeCiphertext(version) });
      mockDecryptWithPin.mockResolvedValue(MNEMONIC);
      mount(LoginPinPage);
      await flush();
      await enterPin(CREATE_PIN);
      await flush();

      expect(mockDecryptWithPin).toHaveBeenCalledWith(JSON.stringify(CREATE_PIN));
      expect(mockLoginSecuritySwitch).not.toHaveBeenCalled();
      expect(mockSetAccountMnemonic).toHaveBeenCalledWith(MNEMONIC);
      expect(mockNavigate.replace).toHaveBeenCalledWith(
        'ConnectingToNodeLoadingScreen',
        { expectedMnemonicHash: `HASH(${MNEMONIC})` },
      );
    },
  );

  it('ciphertext that fails to decrypt falls through to handleWrongPin', async () => {
    installLoginState({ encryptedMnemonic: forgeCiphertext('v3') });
    mockDecryptWithPin.mockResolvedValue(null);
    mount(LoginPinPage);
    await flush();
    await enterPin(CREATE_PIN);
    await flush();

    expect(mockDecryptWithPin).toHaveBeenCalled();
    expect(mockLoginSecuritySwitch).not.toHaveBeenCalled();
    expect(mockSetAccountMnemonic).not.toHaveBeenCalled();
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      'PERSISTED_LOGIN_COUNT_KEY',
      JSON.stringify(1),
    );
  });

  it('plaintext seed + correct PIN takes the handleLoginSecuritySwitch path', async () => {
    installLoginState({ encryptedMnemonic: MNEMONIC });
    mockLoginSecuritySwitch.mockResolvedValue(true);
    mount(LoginPinPage);
    await flush();
    await enterPin(CREATE_PIN);
    await flush();

    expect(mockDecryptWithPin).not.toHaveBeenCalled();
    expect(mockLoginSecuritySwitch).toHaveBeenCalledWith(
      MNEMONIC,
      CREATE_PIN,
      'pin',
    );
    expect(mockSetAccountMnemonic).toHaveBeenCalledWith(MNEMONIC);
    expect(mockNavigate.replace).toHaveBeenCalledWith(
      'ConnectingToNodeLoadingScreen',
      { expectedMnemonicHash: `HASH(${MNEMONIC})` },
    );
  });

  it('B1: plaintext seed + wrong PIN goes to handleWrongPin, never the security switch', async () => {
    installLoginState({ encryptedMnemonic: MNEMONIC });
    mount(LoginPinPage);
    await flush();
    await enterPin([9, 9, 9, 9]);
    await flush();

    expect(mockDecryptWithPin).not.toHaveBeenCalled();
    // The sha256 raw-PIN gate failed — the seed must NOT be re-encrypted under
    // the attacker's PIN.
    expect(mockLoginSecuritySwitch).not.toHaveBeenCalled();
    expect(mockSetAccountMnemonic).not.toHaveBeenCalled();
    expect(mockNavigate.replace).not.toHaveBeenCalled();
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      'PERSISTED_LOGIN_COUNT_KEY',
      JSON.stringify(1),
    );
  });

  it('keychain didWork:false goes to handleWrongPin without attempting a decrypt', async () => {
    installLoginState({ encryptedMnemonic: false });
    mockRetrieveData.mockImplementation(key => {
      if (key === 'pinHash')
        return Promise.resolve({ didWork: true, value: RAW_PIN_JSON });
      return Promise.resolve({ didWork: false, value: false });
    });
    mount(LoginPinPage);
    await flush();
    await enterPin(CREATE_PIN);
    await flush();

    expect(mockDecryptWithPin).not.toHaveBeenCalled();
    expect(mockLoginSecuritySwitch).not.toHaveBeenCalled();
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      'PERSISTED_LOGIN_COUNT_KEY',
      JSON.stringify(1),
    );
  });

  it('garbage value goes to handleWrongPin', async () => {
    installLoginState({ encryptedMnemonic: 'not a mnemonic or envelope' });
    mount(LoginPinPage);
    await flush();
    await enterPin(CREATE_PIN);
    await flush();

    expect(mockDecryptWithPin).not.toHaveBeenCalled();
    expect(mockLoginSecuritySwitch).not.toHaveBeenCalled();
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      'PERSISTED_LOGIN_COUNT_KEY',
      JSON.stringify(1),
    );
  });
});
