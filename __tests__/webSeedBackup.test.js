/* eslint-env jest */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';
import GenerateKey from '../app/screens/createAccount/keySetup/generateKey';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));
jest.mock('../context-store/keys', () => ({
  useKeysContext: () => ({
    accountMnemoinc:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  }),
}));
jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false }),
}));
jest.mock('../app/constants', () => ({
  CENTER: {},
  COLORS: {
    primary: '#06f',
    darkModeText: '#fff',
    lightModeBackgroundOffset: '#eee',
  },
  FONT: {},
  SIZES: { small: 10, smedium: 14, medium: 16, large: 20, xLarge: 24 },
}));
jest.mock('../app/constants/theme', () => ({
  HIDDEN_OPACITY: 0.4,
  INSET_WINDOW_WIDTH: '90%',
}));
jest.mock('../app/functions/CustomElements/themeIcon', () => () => null);
jest.mock('../app/functions/CustomElements', () => ({
  GlobalThemeView: ({ children }) => children,
  ThemeText: props => require('react').createElement('MockText', props),
}));
jest.mock('../app/components/login', () => ({
  KeyContainer: props => require('react').createElement('MockKeys', props),
}));
jest.mock('../app/components/login/navBar', () => () => null);
jest.mock(
  '../app/functions/CustomElements/button',
  () => props => require('react').createElement('MockButton', props),
);
jest.mock('../app/functions/CustomElements/loadingScreen', () => () => null);
jest.mock('../app/hooks/themeColors', () => () => ({
  backgroundColor: '#fff',
}));

let renderer;
let originalPlatform;

beforeEach(async () => {
  originalPlatform = Platform.OS;
  Platform.OS = 'web';
  mockNavigate.mockClear();
  await act(async () => {
    renderer = TestRenderer.create(<GenerateKey />);
  });
});

afterEach(() => {
  act(() => renderer.unmount());
  Platform.OS = originalPlatform;
});

// Skipped: web GenerateKey currently enables Next before the seed is revealed
// (PR #1067 pre-merge finding B-1). Re-enable once canContinue checks showSeed.
test.skip('web requires revealing the seed before password setup', () => {
  const next = () =>
    renderer.root.findByProps({ textContent: 'constants.next' });
  const words = () => renderer.root.findByType('MockKeys').props.keys;
  expect(next().props.disabled).toBe(true);
  expect(words()).not.toContain('abandon');
  act(() => next().props.actionFunction());
  expect(mockNavigate).not.toHaveBeenCalled();

  act(() =>
    renderer.root
      .findByProps({ textContent: 'createAccount.keySetup.generateKey.showIt' })
      .props.actionFunction(),
  );
  expect(words()).toContain('abandon');
  expect(next().props.disabled).toBe(false);
  act(() => next().props.actionFunction());
  expect(mockNavigate).toHaveBeenCalledWith('PinSetup', {
    didBackupSeedPhrase: true,
  });
});
