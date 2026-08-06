import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput, View } from 'react-native';

const mockNavigation = {
  navigate: jest.fn(),
};
const mockToggleMasterInfoObject = jest.fn();
const mockShowToast = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('../context-store/context', () => ({
  useGlobalContextProvider: () => ({
    masterInfoObject: {
      uuid: 'attacker-uuid',
      nip5Settings: { name: '', pubkey: '' },
    },
    toggleMasterInfoObject: mockToggleMasterInfoObject,
  }),
}));

jest.mock('../context-store/toastManager', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => key,
  }),
}));

jest.mock('../app/functions/nostr', () => ({
  npubToHex: jest.fn(() => ({
    didWork: true,
    data: 'aa'.repeat(32),
  })),
}));

jest.mock('../app/functions', () => ({
  copyToClipboard: jest.fn(),
}));

jest.mock('../app/functions/customNavigation', () => ({
  keyboardGoBack: jest.fn(),
}));

// Emulate Firestore exact-match semantics on the `nameLower` field:
// the canonical name 'satoshi' is already registered by someone else, but the
// whitespace-padded variants are not.
jest.mock('../db', () => ({
  isValidNip5Name: jest.fn(async name => name.toLowerCase() !== 'satoshi'),
  addNip5toCollection: jest.fn(async () => true),
}));

jest.mock('../app/functions/CustomElements', () => {
  const MockReact = require('react');
  const RN = require('react-native');

  return {
    GlobalThemeView: ({ children }) =>
      MockReact.createElement(RN.View, null, children),
    ThemeText: ({ content }) =>
      MockReact.createElement(RN.Text, null, content),
    CustomKeyboardAvoidingView: ({ children }) =>
      MockReact.createElement(RN.View, null, children),
  };
});

jest.mock(
  '../app/functions/CustomElements/settingsTopBar',
  () =>
    function MockCustomSettingsTopBar() {
      const MockReact = require('react');
      const RN = require('react-native');

      return MockReact.createElement(RN.View, null);
    },
);

jest.mock(
  '../app/functions/CustomElements/searchInput',
  () =>
    function MockCustomSearchInput({ inputText, setInputText, placeholderText }) {
      const MockReact = require('react');
      const RN = require('react-native');

      return MockReact.createElement(RN.TextInput, {
        testID: `input-${placeholderText}`,
        value: inputText,
        onChangeText: setInputText,
      });
    },
);

jest.mock(
  '../app/functions/CustomElements/button',
  () =>
    function MockCustomButton({ actionFunction, textContent }) {
      const MockReact = require('react');
      const RN = require('react-native');

      return MockReact.createElement(
        RN.TouchableOpacity,
        { testID: 'save-button', onPress: actionFunction },
        MockReact.createElement(RN.Text, null, textContent),
      );
    },
);

jest.mock(
  '../app/functions/CustomElements/themeIcon',
  () =>
    function MockThemeIcon() {
      const MockReact = require('react');
      const RN = require('react-native');

      return MockReact.createElement(RN.Text, null, 'icon');
    },
);

const Nip5VerificationPage = require('../app/components/admin/homeComponents/settingsContent/nip5/nip5Account')
  .default;
const { isValidNip5Name, addNip5toCollection } = require('../db');

async function renderPage() {
  let renderer;

  await act(async () => {
    renderer = ReactTestRenderer.create(<Nip5VerificationPage />);
    await Promise.resolve();
  });

  return renderer;
}

function findInput(renderer, placeholderKey) {
  return renderer.root.findByProps({ testID: `input-${placeholderKey}` });
}

async function typeInto(renderer, placeholderKey, value) {
  await act(async () => {
    findInput(renderer, placeholderKey).props.onChangeText(value);
  });
}

async function saveName(renderer) {
  await act(async () => {
    renderer.root.findByProps({ testID: 'save-button' }).props.onPress();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  });
}

describe('Nip5VerificationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isValidNip5Name.mockImplementation(async name => {
      return name.toLowerCase() !== 'satoshi';
    });
  });

  test('rejects a whitespace-padded name whose trimmed form is already registered', async () => {
    const renderer = await renderPage();

    await typeInto(renderer, 'settings.nip5.usernameInputPlaceholder', 'satoshi ');
    await typeInto(renderer, 'settings.nip5.publicKeyPlaceholder', 'aa'.repeat(32));

    await saveName(renderer);

    expect(isValidNip5Name).toHaveBeenCalledWith('satoshi');
    expect(addNip5toCollection).not.toHaveBeenCalled();
  });

  test('still allows registering a genuinely free name', async () => {
    const renderer = await renderPage();

    await typeInto(renderer, 'settings.nip5.usernameInputPlaceholder', 'bob');
    await typeInto(renderer, 'settings.nip5.publicKeyPlaceholder', 'aa'.repeat(32));

    await saveName(renderer);

    expect(addNip5toCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'bob',
        nameLower: 'bob',
      }),
      'attacker-uuid',
    );
  });
});
