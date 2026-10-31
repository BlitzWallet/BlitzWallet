/* eslint-env jest */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNRestart from 'react-native-restart-newarch';
import LegacyWebMigration from '../../app/screens/createAccount/legacyWebMigration';
import { migrateLegacyWallet } from '../../app/functions/legacyWebMigration';
import WalletResetSheet from '../../app/components/admin/loginComponents/walletResetSheet';

const mockNavigation = {
  navigate: jest.fn(),
  reset: jest.fn(),
  goBack: jest.fn(),
};
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { View: RN.View },
    FadeIn: { duration: () => undefined },
    FadeOut: { duration: () => undefined },
    useReducedMotion: () => false,
  };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));
jest.mock('react-native-restart-newarch', () => ({ restart: jest.fn() }));
jest.mock('../../context-store/keys', () => ({
  useKeysContext: () => ({ setAccountMnemonic: jest.fn() }),
}));
jest.mock('../../context-store/theme', () => ({
  useGlobalThemeContext: () => ({
    theme: false,
    darkModeType: false,
    tokens: require('../../app/constants/themes').MODES.light,
  }),
  useTheme: () => ({
    tokens: require('../../app/constants/themes').MODES.light,
  }),
}));
jest.mock('../../app/hooks/themeColors', () => () => ({
  tokens: require('../../app/constants/themes').MODES.light,
}));
jest.mock('../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
}));
jest.mock('../../app/functions/legacyWebMigration', () => ({
  LEGACY_WALLET_KEY: 'walletKey',
  migrateLegacyWallet: jest.fn(),
}));
jest.mock('../../app/functions/CustomElements', () => ({
  GlobalThemeView: ({ children }) => children,
  ThemeText: 'ThemeText',
}));
jest.mock('../../app/functions/CustomElements/button', () => 'Button');
jest.mock('../../app/functions/CustomElements/searchInput', () => 'Input');
jest.mock(
  '../../app/functions/CustomElements/actionCircleContainer',
  () => 'Icon',
);
jest.mock('../../app/functions/CustomElements/themeIcon', () => 'Icon');

const recoveryLabel = 'createAccount.legacyWebMigration.useRecoveryPhrase';
let renderer;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('walletKey', 'unreadable legacy value');
  await AsyncStorage.setItem('other-key', 'keep');
  await act(async () => {
    renderer = TestRenderer.create(<LegacyWebMigration />);
  });
});

afterEach(() => {
  act(() => renderer.unmount());
  jest.useRealTimers();
});

function recoveryButton() {
  return renderer.root.findByProps({ text: recoveryLabel });
}

function openConfirmation() {
  act(() => recoveryButton().props.onPress());
  expect(mockNavigation.navigate).toHaveBeenCalledWith(
    'CustomHalfModal',
    expect.objectContaining({
      wantedContent: 'walletReset',
      title: recoveryLabel,
      message: 'createAccount.legacyWebMigration.recoveryConfirm',
      confirmFunction: expect.any(Function),
    }),
  );
  return mockNavigation.navigate.mock.calls.at(-1)[1];
}

test('opening and dismissing confirmation preserves the legacy wallet', async () => {
  expect(recoveryButton().props.disabled).toBe(false);
  const params = openConfirmation();
  const handleBackPressFunction = jest.fn();
  let confirmation;
  act(() => {
    confirmation = TestRenderer.create(
      <WalletResetSheet
        {...params}
        handleBackPressFunction={handleBackPressFunction}
        setContentHeight={jest.fn()}
      />,
    );
  });
  act(() => {
    confirmation.root
      .findByProps({ textContent: 'constants.cancel' })
      .props.actionFunction();
  });
  expect(handleBackPressFunction).toHaveBeenCalledTimes(1);
  act(() => confirmation.unmount());
  expect(await AsyncStorage.getItem('walletKey')).toBe(
    'unreadable legacy value',
  );
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  expect(RNRestart.restart).not.toHaveBeenCalled();
});

test('confirmation removes only the legacy key before reloading onboarding', async () => {
  const params = openConfirmation();
  RNRestart.restart.mockImplementationOnce(() => {
    expect(AsyncStorage.__INTERNAL_MOCK_STORAGE__.walletKey).toBeUndefined();
  });
  await act(async () => params.confirmFunction());
  expect(await AsyncStorage.getItem('walletKey')).toBeNull();
  expect(await AsyncStorage.getItem('other-key')).toBe('keep');
  expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('walletKey');
  expect(RNRestart.restart).toHaveBeenCalledTimes(1);
  expect(migrateLegacyWallet).not.toHaveBeenCalled();
});

test('failed removal shows a retryable error without reloading', async () => {
  const params = openConfirmation();
  AsyncStorage.removeItem.mockRejectedValueOnce(
    new Error('Storage unavailable'),
  );
  await act(async () => params.confirmFunction());
  expect(await AsyncStorage.getItem('walletKey')).toBe(
    'unreadable legacy value',
  );
  expect(RNRestart.restart).not.toHaveBeenCalled();
  expect(
    renderer.root.findByProps({
      content: 'createAccount.legacyWebMigration.recoveryError',
    }),
  ).toBeTruthy();
  expect(recoveryButton().props.disabled).toBe(false);
});

test('migration blocks recovery until a wrong password returns', async () => {
  migrateLegacyWallet.mockResolvedValueOnce({ status: 'wrong-password' });
  act(() => renderer.root.findByType('Input').props.setInputText('wrong'));
  let submission;
  act(() => {
    submission = renderer.root
      .findByProps({
        textContent: 'createAccount.legacyWebMigration.button',
      })
      .props.actionFunction();
  });
  expect(recoveryButton().props.disabled).toBe(true);
  act(() => recoveryButton().props.onPress());
  expect(mockNavigation.navigate).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(100);
    await submission;
  });
  expect(recoveryButton().props.disabled).toBe(false);
  const params = openConfirmation();
  await act(async () => params.confirmFunction());
  expect(await AsyncStorage.getItem('walletKey')).toBeNull();
  expect(RNRestart.restart).toHaveBeenCalledTimes(1);
});
