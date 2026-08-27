/* eslint-env jest */
// ---------------------------------------------------------------------------
// Regression: a pairing failure on the Scan tab (e.g. the parent declines)
// shows its error copy ONLY on the Scan tab. The Code tab must never render
// errorMessage — neither a stale message from an earlier failed scan nor one
// arriving while the Code tab is already up (the context clears it on tab
// switches via resetSession, and the Code branch simply gates it out).
//
// Drives the real screen with a mutable mocked claim context and a stubbed
// WordsQrToggle whose options are clickable host elements.
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockResetSession = jest.fn();
const mockSubmitPairing = jest.fn();

let mockClaimState = {
  status: 'idle',
  errorMessage: '',
  submitPairing: (...a) => mockSubmitPairing(...a),
  resetSession: (...a) => mockResetSession(...a),
};

jest.mock('../../context-store/childClaimContext', () => ({
  useChildClaim: () => mockClaimState,
}));

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: k => k }) }));

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardController: { dismiss: jest.fn() },
}));

jest.mock('@react-navigation/native', () => {
  const { useEffect, useRef } = require('react');
  return {
    useNavigation: () => ({ navigate: jest.fn() }),
    useIsFocused: () => true,
    useFocusEffect: cb => {
      const ref = useRef(cb);
      ref.current = cb;
      useEffect(() => {
        const cleanup = ref.current();
        return () => {
          if (typeof cleanup === 'function') cleanup();
        };
      }, []);
    },
  };
});

jest.mock('../../app/functions/customNavigation', () => ({
  keyboardGoBack: jest.fn(),
  keyboardNavigate: jest.fn(),
}));

jest.mock('../../app/functions/accounts/childPairing', () => ({
  parsePairingQr: jest.fn(),
}));

jest.mock('../../app/hooks/themeColors', () => ({
  __esModule: true,
  default: () => ({ backgroundOffset: '#000000' }),
}));

// Every ThemeText's content lands here so assertions can check which copy is
// on screen.
const renderedTexts = [];

jest.mock('../../app/functions/CustomElements', () => ({
  __esModule: true,
  CustomKeyboardAvoidingView: ({ children }) => children,
  ThemeText: ({ content }) => {
    if (content) renderedTexts.push(String(content));
    return null;
  },
}));

jest.mock('../../app/functions/CustomElements/settingsTopBar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../app/functions/CustomElements/button', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../app/functions/CustomElements/searchInput', () => ({
  __esModule: true,
  default: () => null,
}));

// Clickable toggle stub: two host elements that drive the screen's tab state.
jest.mock('../../app/functions/CustomElements/wordsQrToggle', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ option1Value, option2Value, setSelectedDisplayOption }) => [
      React.createElement('view', {
        key: 'option1',
        testID: 'toggle-code',
        onClick: () => setSelectedDisplayOption(option1Value),
      }),
      React.createElement('view', {
        key: 'option2',
        testID: 'toggle-scan',
        onClick: () => setSelectedDisplayOption(option2Value),
      }),
    ],
  };
});

jest.mock('../../app/functions/CustomElements/camera/inlineQrScanner', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../app/functions/CustomElements/loadingScreen', () => ({
  __esModule: true,
  default: () => null,
}));

// childQRWaiting (imported, only rendered while awaiting) pulls these in.
jest.mock('../../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: null }),
}));
jest.mock('lottie-react-native', () => 'LottieView');
jest.mock('../../app/functions/lottieAnimations', () => ({
  getConfirmTxAnimation: () => ({}),
  getErrorTxAnimation: () => ({}),
}));

const ChildEnterCode =
  require('../../app/screens/createAccount/childClaim/childEnterCode').default;

describe('childEnterCode — pairing error is scan-tab only', () => {
  let renderer;

  beforeEach(() => {
    jest.clearAllMocks();
    renderedTexts.length = 0;
    mockClaimState = {
      status: 'idle',
      errorMessage: '',
      submitPairing: (...a) => mockSubmitPairing(...a),
      resetSession: (...a) => mockResetSession(...a),
    };
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
  });

  async function mountScreen() {
    await act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(ChildEnterCode),
      );
    });
  }

  function selectTab(testId) {
    act(() => {
      renderer.root.findByProps({ testID: testId }).props.onClick();
    });
  }

  function applyClaim(patch) {
    mockClaimState = { ...mockClaimState, ...patch };
    act(() => {
      renderer.update(React.createElement(ChildEnterCode));
    });
  }

  test('a failure landing while the code tab is up never renders there', async () => {
    await mountScreen();

    applyClaim({
      status: 'error',
      errorMessage: 'settings.childAccounts.claim.canceledByParent',
    });

    expect(renderedTexts).not.toContain(
      'settings.childAccounts.claim.canceledByParent',
    );
  });

  test('scan-tab error is shown there, then gone after switching to the code tab', async () => {
    await mountScreen();

    selectTab('toggle-scan');
    applyClaim({
      status: 'error',
      errorMessage: 'settings.childAccounts.claim.canceledByParent',
    });
    expect(renderedTexts).toContain(
      'settings.childAccounts.claim.canceledByParent',
    );

    const renderedBeforeSwitch = renderedTexts.length;
    selectTab('toggle-code');

    // The switch resets the session (clearing the context state) ...
    expect(mockResetSession).toHaveBeenCalled();
    // ... and the code branch no longer renders the message either way.
    expect(renderedTexts.slice(renderedBeforeSwitch)).not.toContain(
      'settings.childAccounts.claim.canceledByParent',
    );
  });
});
