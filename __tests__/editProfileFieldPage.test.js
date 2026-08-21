import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  popTo: jest.fn(),
  replace: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

const mockToggleGlobalContactsInformation = jest.fn();

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: true, darkModeType: false }),
}));

jest.mock('../context-store/globalContacts', () => ({
  useGlobalContactsInfo: () => ({
    globalContactsInformation: {
      myProfile: {
        uuid: 'uuid-1',
        name: 'Alice',
        uniqueName: 'alice',
        bio: '',
        didEditProfile: true,
      },
      addedContacts: [],
    },
    toggleGlobalContactsInformation: mockToggleGlobalContactsInformation,
  }),
}));

jest.mock('../db', () => ({
  isUniqueNameAvailable: jest.fn(),
  claimUniqueName: jest.fn(async () => ({ status: 'ok' })),
}));

jest.mock('../context-store/keys', () => ({
  useKeysContext: () => ({ publicKey: 'pub-1' }),
}));

jest.mock('../app/functions/accounts/usernameReservationRecord', () => ({
  __esModule: true,
  setUsernameReservationRecord: jest.fn(async () => {}),
  clearUsernameReservationRecord: jest.fn(async () => {}),
}));

jest.mock('../app/hooks/themeColors', () => () => ({
  textColor: '#000',
  textInputColor: '#000',
  backgroundColor: '#fff',
  backgroundOffset: '#eee',
  themeBackgroundOffset: '#eee',
  textInputBackground: '#fff',
  transparentOveraly: 'transparent',
}));

jest.mock('../app/hooks/useHandleBackPressNew', () => () => {});

jest.mock('../app/functions/customNavigation', () => ({
  keyboardGoBack: jest.fn(async () => {}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key =>
      key === 'constants.save'
        ? 'Save'
        : key === 'constants.back'
          ? 'Back'
          : key,
  }),
}));

jest.mock('../app/functions/CustomElements', () => {
  const MockReact = require('react');
  const { View, Text } = require('react-native');
  return {
    CustomKeyboardAvoidingView: ({ children }) =>
      MockReact.createElement(View, null, children),
    ThemeText: ({ content }) =>
      MockReact.createElement(Text, null, content || null),
  };
});

jest.mock(
  '../app/functions/CustomElements/settingsTopBar',
  () => () => null,
);
jest.mock('../app/functions/CustomElements/themeIcon', () => () => null);

jest.mock('../app/functions/CustomElements/button', () => {
  const MockReact = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return function MockCustomButton({ actionFunction, textContent }) {
    return MockReact.createElement(
      TouchableOpacity,
      { testID: 'submit-button', onPress: actionFunction },
      MockReact.createElement(
        Text,
        { testID: 'submit-button-text' },
        textContent,
      ),
    );
  };
});

jest.mock('../app/functions/CustomElements/searchInput', () => {
  const MockReact = require('react');
  const { TextInput } = require('react-native');
  return function MockCustomSearchInput({ inputText, setInputText }) {
    return MockReact.createElement(TextInput, {
      testID: 'profile-field-input',
      value: inputText,
      onChangeText: setInputText,
    });
  };
});

const EditProfileFieldPage =
  require('../app/components/admin/homeComponents/contacts/internalComponents/editProfileFieldPage')
    .default;
const { isUniqueNameAvailable, claimUniqueName } = require('../db');
const {
  setUsernameReservationRecord,
} = require('../app/functions/accounts/usernameReservationRecord');
const {
  normalizePairingName,
} = require('../app/functions/accounts/childPairing');

function renderEditProfileFieldPage(fieldKey) {
  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <EditProfileFieldPage route={{ params: { fieldKey } }} />,
    );
  });
  return renderer;
}

function textByTestId(renderer, testID) {
  function flattenText(value) {
    if (Array.isArray(value)) {
      return value.map(flattenText).join('');
    }
    if (React.isValidElement(value)) {
      return flattenText(value.props.children);
    }
    return value === null || value === undefined ? '' : String(value);
  }
  return flattenText(renderer.root.findByProps({ testID }).props.children);
}

function input(renderer) {
  return renderer.root.findByProps({ testID: 'profile-field-input' });
}

function pressSubmit(renderer) {
  act(() => {
    renderer.root.findByProps({ testID: 'submit-button' }).props.onPress();
  });
}

describe('EditProfileFieldPage unique-name availability check', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  test('does not save a unique name whose availability was never checked', async () => {
    let resolveFirstCheck;
    isUniqueNameAvailable.mockReturnValueOnce(
      new Promise(resolve => {
        resolveFirstCheck = resolve;
      }),
    );

    const renderer = renderEditProfileFieldPage('uniquename');

    act(() => {
      input(renderer).props.onChangeText('freename');
    });
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(isUniqueNameAvailable).toHaveBeenCalledWith('pub-1', 'freename');

    act(() => {
      input(renderer).props.onChangeText('victimname');
    });
    expect(isUniqueNameAvailable).not.toHaveBeenCalledWith('pub-1', 'victimname');

    await act(async () => {
      resolveFirstCheck(true);
      await Promise.resolve();
    });

    expect(textByTestId(renderer, 'submit-button-text')).toBe('Back');

    pressSubmit(renderer);

    expect(mockToggleGlobalContactsInformation).not.toHaveBeenCalled();
  });

  test('saving an available unique name stores NFC-aligned keys and records the reservation', async () => {
    isUniqueNameAvailable.mockResolvedValueOnce(true);

    const renderer = renderEditProfileFieldPage('uniquename');

    act(() => {
      input(renderer).props.onChangeText('freename');
    });
    act(() => {
      jest.advanceTimersByTime(600);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Availability resolved AVAILABLE → the button offers Save.
    expect(textByTestId(renderer, 'submit-button-text')).toBe('Save');

    await act(async () => {
      renderer.root.findByProps({ testID: 'submit-button' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Claim runs before the profile write (oldLower is '' — mock has no
    // uniqueNameLower).
    expect(claimUniqueName).toHaveBeenCalledWith('pub-1', '', 'freename');

    const savedProfile =
      mockToggleGlobalContactsInformation.mock.calls[0][0].myProfile;
    expect(savedProfile.uniqueName).toBe('freename');
    // Fix 3: the stored lookup key is the reservation key exactly.
    expect(savedProfile.uniqueNameLower).toBe(normalizePairingName('freename'));

    expect(setUsernameReservationRecord).toHaveBeenCalledWith({
      lower: normalizePairingName('freename'),
      at: expect.any(Number),
    });
  });
});
