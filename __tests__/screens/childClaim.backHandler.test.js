/* eslint-env jest */
// ---------------------------------------------------------------------------
// F-5 regression: the child claim screens must answer the Android hardware
// back button by resetting the pairing session and popping the flow — the same
// contract childVerifyCode.js already had. Before the fix, childEnterCode /
// childEnterPairCode only wired the on-screen back chevron, so a hardware back
// on those screens left a live session running (a zombie that later resolves
// can act on a newer session's globals).
//
// Drives the real screens (BackHandler spy): mounts the screen, lets the
// useFocusEffect-registered listener attach, then invokes the captured
// hardwareBackPress handler and asserts resetSession + keyboardGoBack fire.
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { BackHandler } from 'react-native';

const mockResetSession = jest.fn();
const mockSubmitPairing = jest.fn();
const mockKeyboardGoBack = jest.fn();
const mockKeyboardNavigate = jest.fn();

jest.mock('../../context-store/childClaimContext', () => ({
  useChildClaim: () => ({
    status: 'idle',
    errorMessage: '',
    submitPairing: mockSubmitPairing,
    resetSession: mockResetSession,
  }),
}));

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: k => k }) }));

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardController: { dismiss: jest.fn() },
}));

// useFocusEffect runs the callback (the listener registration) once on mount,
// mirroring the navigation library's focus semantics.
jest.mock('@react-navigation/native', () => {
  const { useEffect, useRef } = require('react');
  return {
    useNavigation: () => ({ navigate: jest.fn() }),
    useIsFocused: () => true,
    useRoute: () => ({ params: { name: 'ParentName' } }),
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
  keyboardGoBack: (...a) => mockKeyboardGoBack(...a),
  keyboardNavigate: (...a) => mockKeyboardNavigate(...a),
}));

jest.mock('../../app/functions/accounts/childPairing', () => ({
  parsePairingQr: jest.fn(),
}));

jest.mock('../../app/hooks/themeColors', () => ({
  __esModule: true,
  default: () => ({ backgroundOffset: '#000000' }),
}));

jest.mock('../../app/functions/CustomElements', () => ({
  CustomKeyboardAvoidingView: ({ children }) => children,
  GlobalThemeView: ({ children }) => children,
  ThemeText: () => null,
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
jest.mock('../../app/functions/CustomElements/wordsQrToggle', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../app/functions/CustomElements/camera/inlineQrScanner', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../app/functions/CustomElements/loadingScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../app/functions/CustomElements/customNumberKeyboard', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../app/functions/CustomElements/segmentedCodeInput', () => ({
  __esModule: true,
  default: () => null,
}));

// childQRWaiting (imported, not rendered on the idle screen) pulls these in.
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
const ChildEnterPairCode =
  require('../../app/screens/createAccount/childClaim/childEnterPairCode').default;

describe('child claim screens — hardware back (F-5)', () => {
  let renderer;
  let addEventListenerSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    addEventListenerSpy = jest.spyOn(BackHandler, 'addEventListener');
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
    addEventListenerSpy.mockRestore();
  });

  async function renderScreen(Screen) {
    await act(async () => {
      renderer = ReactTestRenderer.create(React.createElement(Screen));
    });
  }

  async function pressHardwareBack() {
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    );
    const handler = addEventListenerSpy.mock.calls[0][1];
    await act(async () => {
      handler();
    });
  }

  test('childEnterCode: hardware back resets the session and goes back', async () => {
    await renderScreen(ChildEnterCode);
    await pressHardwareBack();
    expect(mockResetSession).toHaveBeenCalled();
    expect(mockKeyboardGoBack).toHaveBeenCalled();
  });

  test('childEnterPairCode: hardware back resets the session and goes back', async () => {
    await renderScreen(ChildEnterPairCode);
    await pressHardwareBack();
    expect(mockResetSession).toHaveBeenCalled();
    expect(mockKeyboardGoBack).toHaveBeenCalled();
  });
});
