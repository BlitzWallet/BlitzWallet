import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AppState, Platform, TextInput, View } from 'react-native';

// ---------------------------------------------------------------------------
// Mocks
//
// CustomSearchInput's complexity is an imperative focus/blur state machine
// built on react-native-keyboard-controller + AppState. None of that state is
// visible to React renders (it lives in refs), so the only observable surface
// is: the props handed to the underlying <TextInput>, the consumer callbacks
// (onFocusFunction / onBlurFunction / onSubmitEditingFunction / setInputText),
// the keyboard-controller queries, and the keyboard / AppState listeners.
//
// Everything below gives the tests deterministic control over those inputs.
// ---------------------------------------------------------------------------

// Holds the captured keyboard listeners + controllable visibility. Prefixed
// with `mock` so the jest.mock factory is allowed to reference it.
//
// `listeners[event]` is an ARRAY of handlers, mirroring the real global
// KeyboardEvents: every mounted CustomSearchInput subscribes to the same
// events, so one keyboard transition fans out to ALL of them. This is what
// makes the "multiple instances alive at once" tests faithful.
const mockKB = {
  listeners: {},
  subscriptions: [],
  isVisible: jest.fn(() => false),
  state: jest.fn(() => ({ height: 0 })),
};

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardController: {
    isVisible: (...args) => mockKB.isVisible(...args),
    state: (...args) => mockKB.state(...args),
  },
  KeyboardEvents: {
    addListener: jest.fn((event, handler) => {
      if (!mockKB.listeners[event]) mockKB.listeners[event] = [];
      mockKB.listeners[event].push(handler);
      const subscription = {
        event,
        remove: jest.fn(() => {
          const handlers = mockKB.listeners[event] || [];
          const index = handlers.indexOf(handler);
          if (index >= 0) handlers.splice(index, 1);
        }),
      };
      mockKB.subscriptions.push(subscription);
      return subscription;
    }),
  },
}));

const mockThemeState = { theme: false, darkModeType: false };

jest.mock('../../../context-store/theme', () => ({
  useGlobalThemeContext: () => ({
    theme: mockThemeState.theme,
    darkModeType: mockThemeState.darkModeType,
  }),
}));

jest.mock('../../../app/hooks/themeColors', () => ({
  __esModule: true,
  default: () => ({
    textInputColor: 'INPUT_COLOR',
    textInputBackground: 'INPUT_BG',
  }),
}));

jest.mock('../../../app/constants', () => ({
  CENTER: { alignSelf: 'center' },
  COLORS: {
    darkModePlaceholder: 'DARK_PLACEHOLDER',
    lightModePlaceholder: 'LIGHT_PLACEHOLDER',
  },
  FONT: { Title_Regular: 'TitleRegular' },
  SIZES: { medium: 15 },
}));

jest.mock('../../../app/constants/theme', () => ({ HIDDEN_OPACITY: 0.5 }));

const CustomSearchInput =
  require('../../../app/functions/CustomElements/searchInput').default;

// Mirrors the module-level timing constants in searchInput.js.
const BLUR_DELAY_MS = 150;
const ANDROID_BLUR_CONFIRMATION_MS = 80;
const APP_ACTIVE_KEYBOARD_CHECK_DELAY_MS = 120;
const AUTO_FOCUS_DELAY_MS = 150;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// Array of AppState 'change' handlers, again mirroring the global AppState:
// every mounted instance's listener fires on a single app transition.
let appStateHandlers;
let appStateSubscriptions;

function renderSearchInput(overrides = {}) {
  const ref = overrides.textInputRef ?? { current: null };
  const props = {
    inputText: '',
    setInputText: jest.fn(),
    placeholderText: 'Search',
    ...overrides,
    textInputRef: ref,
  };

  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(<CustomSearchInput {...props} />);
  });

  return {
    renderer,
    ref,
    props,
    input: () => renderer.root.findByType(TextInput),
    unmount: () => act(() => renderer.unmount()),
  };
}

// A fake native TextInput instance that the focus/blur machine inspects via
// inputRef.current. react-test-renderer points the ref at its own mock
// instance; we overwrite it so isFocused()/focus()/blur() are controllable.
function makeNativeInput({ focused = false } = {}) {
  const input = {
    _focused: focused,
    focus: jest.fn(() => {
      input._focused = true;
    }),
    blur: jest.fn(() => {
      input._focused = false;
    }),
    isFocused: jest.fn(() => input._focused),
  };
  input.getNativeRef = jest.fn(() => input);
  return input;
}

// Mounts `count` independent CustomSearchInput instances (separate render
// trees), each with its own onBlur spy and a controllable native input ref.
// They all subscribe to the same global keyboard/AppState events.
function renderInstances(count) {
  const instances = [];
  for (let i = 0; i < count; i++) {
    const onBlur = jest.fn();
    const rendered = renderSearchInput({
      placeholderText: `input-${i}`,
      onBlurFunction: onBlur,
    });
    rendered.ref.current = makeNativeInput({ focused: false });
    instances.push({ ...rendered, onBlur, index: i });
  }
  return instances;
}

function setKeyboardVisible(visible) {
  mockKB.isVisible.mockReturnValue(visible);
  mockKB.state.mockReturnValue({ height: visible ? 300 : 0 });
}

function fireKeyboard(event, payload = {}) {
  act(() => {
    // Snapshot before iterating: a handler may add/remove listeners.
    (mockKB.listeners[event] || []).slice().forEach(handler => handler(payload));
  });
}

function fireAppState(state) {
  act(() => {
    appStateHandlers.slice().forEach(handler => handler(state));
  });
}

function advance(ms) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => {});

  mockKB.listeners = {};
  mockKB.subscriptions = [];
  mockKB.isVisible.mockReset();
  mockKB.isVisible.mockReturnValue(false);
  mockKB.state.mockReset();
  mockKB.state.mockReturnValue({ height: 0 });

  mockThemeState.theme = false;
  mockThemeState.darkModeType = false;

  Platform.OS = 'ios';

  appStateHandlers = [];
  appStateSubscriptions = [];
  AppState.addEventListener.mockReset();
  AppState.addEventListener.mockImplementation((type, cb) => {
    if (type === 'change') appStateHandlers.push(cb);
    const subscription = {
      remove: jest.fn(() => {
        const index = appStateHandlers.indexOf(cb);
        if (index >= 0) appStateHandlers.splice(index, 1);
      }),
    };
    appStateSubscriptions.push(subscription);
    return subscription;
  });

  TextInput.State = { currentlyFocusedInput: jest.fn(() => null) };
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  jest.restoreAllMocks();
  Platform.OS = 'ios';
});

// ---------------------------------------------------------------------------
// Smoke / harness sanity
// ---------------------------------------------------------------------------

describe('CustomSearchInput - rendering basics', () => {
  test('renders without crashing', () => {
    expect(() => renderSearchInput()).not.toThrow();
  });

  test('passes placeholder text through to the TextInput', () => {
    const { input } = renderSearchInput({ placeholderText: 'Find a contact' });
    expect(input().props.placeholder).toBe('Find a contact');
  });

  test('calls setInputText with the typed value', () => {
    const setInputText = jest.fn();
    const { input } = renderSearchInput({ setInputText });
    act(() => {
      input().props.onChangeText('hello');
    });
    expect(setInputText).toHaveBeenCalledWith('hello');
  });
});

// ---------------------------------------------------------------------------
// AppState background -> foreground reconciliation (the known bug)
// ---------------------------------------------------------------------------

describe('CustomSearchInput - app foreground keyboard reconciliation', () => {
  test('fires the owed onBlur when app returns to foreground with the keyboard gone', () => {
    // Reproduces the reported bug: user focuses the input (keyboard shows),
    // backgrounds the app, and returns. While backgrounded the OS hides the
    // keyboard WITHOUT emitting keyboardDidHide, so the component still
    // believes the keyboard is open and never runs the blur the screen is
    // waiting on. Returning to the foreground must reconcile that.
    const onBlur = jest.fn();
    const { ref, input } = renderSearchInput({ onBlurFunction: onBlur });
    ref.current = makeNativeInput({ focused: true });

    act(() => input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    // App backgrounded then foregrounded; keyboard is physically gone but no
    // keyboardDidHide ever fired.
    setKeyboardVisible(false);
    fireAppState('active');
    advance(
      APP_ACTIVE_KEYBOARD_CHECK_DELAY_MS + BLUR_DELAY_MS + 50,
    );

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('does NOT blur when the app returns to foreground with the keyboard still visible', () => {
    // If the keyboard is genuinely still up on return (e.g. the field kept
    // first responder and the OS restored the keyboard), foregrounding must
    // not fire a spurious blur.
    const onBlur = jest.fn();
    const { ref, input } = renderSearchInput({ onBlurFunction: onBlur });
    ref.current = makeNativeInput({ focused: true });

    act(() => input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    // Keyboard is still reported visible on return.
    fireAppState('active');
    advance(APP_ACTIVE_KEYBOARD_CHECK_DELAY_MS + BLUR_DELAY_MS + 50);

    expect(onBlur).not.toHaveBeenCalled();
  });

  test('does not reconcile on background/inactive transitions', () => {
    const onBlur = jest.fn();
    const { ref, input } = renderSearchInput({ onBlurFunction: onBlur });
    ref.current = makeNativeInput({ focused: true });

    act(() => input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    setKeyboardVisible(false);
    fireAppState('background');
    advance(APP_ACTIVE_KEYBOARD_CHECK_DELAY_MS + BLUR_DELAY_MS + 50);

    expect(onBlur).not.toHaveBeenCalled();
  });

  test('does nothing on foreground when the input was never focused', () => {
    const onBlur = jest.fn();
    // Never focus, keyboard never shown.
    renderSearchInput({ onBlurFunction: onBlur });

    fireAppState('active');
    advance(APP_ACTIVE_KEYBOARD_CHECK_DELAY_MS + BLUR_DELAY_MS + 50);

    expect(onBlur).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Prop passthrough & render branches
// ---------------------------------------------------------------------------

describe('CustomSearchInput - prop passthrough', () => {
  test('reflects inputText as the controlled value', () => {
    const { input } = renderSearchInput({ inputText: 'satoshi' });
    expect(input().props.value).toBe('satoshi');
  });

  test('keyboardType defaults to "default" and is passed through', () => {
    expect(renderSearchInput().input().props.keyboardType).toBe('default');
    expect(
      renderSearchInput({ keyboardType: 'numeric' }).input().props.keyboardType,
    ).toBe('numeric');
  });

  test('maxLength is undefined by default and passed through when set', () => {
    expect(renderSearchInput().input().props.maxLength).toBeUndefined();
    expect(renderSearchInput({ maxLength: 12 }).input().props.maxLength).toBe(
      12,
    );
  });

  test('multiline defaults to false and is passed through', () => {
    expect(renderSearchInput().input().props.multiline).toBe(false);
    expect(
      renderSearchInput({ textInputMultiline: true }).input().props.multiline,
    ).toBe(true);
  });

  test('autoCapitalize defaults to "none" and is passed through', () => {
    expect(renderSearchInput().input().props.autoCapitalize).toBe('none');
    expect(
      renderSearchInput({ autoCapitalize: 'sentences' }).input().props
        .autoCapitalize,
    ).toBe('sentences');
  });

  test('returnKeyType defaults to "default" and is passed through', () => {
    expect(renderSearchInput().input().props.returnKeyType).toBe('default');
    expect(
      renderSearchInput({ returnKeyType: 'search' }).input().props.returnKeyType,
    ).toBe('search');
  });

  test('autoCorrect is always disabled', () => {
    expect(renderSearchInput().input().props.autoCorrect).toBe(false);
  });

  test('the underlying TextInput autoFocus is always false, even when the prop is true', () => {
    expect(
      renderSearchInput({ autoFocus: true }).input().props.autoFocus,
    ).toBe(false);
  });

  test('submitBehavior is "blurAndSubmit" by default and undefined when blurOnSubmit is false', () => {
    expect(renderSearchInput().input().props.submitBehavior).toBe(
      'blurAndSubmit',
    );
    expect(
      renderSearchInput({ blurOnSubmit: false }).input().props.submitBehavior,
    ).toBeUndefined();
  });

  test('editable defaults to true; false dims the input with HIDDEN_OPACITY', () => {
    const enabled = renderSearchInput().input();
    expect(enabled.props.editable).toBe(true);
    expect(enabled.props.style.opacity).toBe(1);

    const disabled = renderSearchInput({ editable: false }).input();
    expect(disabled.props.editable).toBe(false);
    expect(disabled.props.style.opacity).toBe(0.5);
  });

  test('keyboardAppearance follows the theme', () => {
    mockThemeState.theme = false;
    expect(renderSearchInput().input().props.keyboardAppearance).toBe('light');

    mockThemeState.theme = true;
    expect(renderSearchInput().input().props.keyboardAppearance).toBe('dark');
  });

  test('placeholderTextColor uses the explicit prop when provided', () => {
    expect(
      renderSearchInput({ placeholderTextColor: '#abcdef' }).input().props
        .placeholderTextColor,
    ).toBe('#abcdef');
  });

  test('placeholderTextColor falls back to theme-derived colors', () => {
    mockThemeState.theme = false;
    expect(
      renderSearchInput().input().props.placeholderTextColor,
    ).toBe('LIGHT_PLACEHOLDER');

    mockThemeState.theme = true;
    mockThemeState.darkModeType = false;
    expect(
      renderSearchInput().input().props.placeholderTextColor,
    ).toBe('DARK_PLACEHOLDER');

    mockThemeState.theme = true;
    mockThemeState.darkModeType = true;
    expect(
      renderSearchInput().input().props.placeholderTextColor,
    ).toBe('LIGHT_PLACEHOLDER');
  });

  test('textInputStyles override the base styles', () => {
    const { input } = renderSearchInput({
      textInputStyles: { color: 'OVERRIDE' },
    });
    expect(input().props.style.color).toBe('OVERRIDE');
  });

  test('containerStyles merge into the wrapping View', () => {
    const { renderer } = renderSearchInput({
      containerStyles: { marginTop: 42 },
    });
    expect(renderer.root.findByType(View).props.style.marginTop).toBe(42);
  });

  test('renders buttonComponent when provided and omits it otherwise', () => {
    const withButton = renderSearchInput({
      buttonComponent: <View testID="search-button" />,
    });
    expect(
      withButton.renderer.root.findAllByProps({ testID: 'search-button' })
        .length,
    ).toBeGreaterThan(0);

    const withoutButton = renderSearchInput();
    expect(
      withoutButton.renderer.root.findAllByProps({ testID: 'search-button' })
        .length,
    ).toBe(0);
  });

  test('uses an externally supplied textInputRef', () => {
    const externalRef = { current: null };
    const { input } = renderSearchInput({ textInputRef: externalRef });
    // react-test-renderer points the supplied ref at the rendered instance.
    expect(externalRef.current).not.toBeNull();
    expect(input()).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Consumer callbacks
// ---------------------------------------------------------------------------

describe('CustomSearchInput - callbacks', () => {
  test('calls onSubmitEditingFunction on submit', () => {
    const onSubmit = jest.fn();
    const { input } = renderSearchInput({ onSubmitEditingFunction: onSubmit });
    act(() => input().props.onSubmitEditing());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('does not throw on submit when no onSubmitEditingFunction is provided', () => {
    const { input } = renderSearchInput();
    expect(() => act(() => input().props.onSubmitEditing())).not.toThrow();
  });

  test('calls onFocusFunction on focus', () => {
    const onFocus = jest.fn();
    const { input } = renderSearchInput({ onFocusFunction: onFocus });
    act(() => input().props.onFocus());
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Blur lifecycle - iOS (no Android confirmation)
// ---------------------------------------------------------------------------

describe('CustomSearchInput - iOS blur', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  test('delays onBlurFunction by BLUR_DELAY_MS when shouldDelayBlur is true', () => {
    const onBlur = jest.fn();
    const { ref, input } = renderSearchInput({ onBlurFunction: onBlur });
    ref.current = makeNativeInput({ focused: false });

    act(() => input().props.onBlur());
    expect(onBlur).not.toHaveBeenCalled();

    advance(BLUR_DELAY_MS);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('runs onBlurFunction synchronously when shouldDelayBlur is false', () => {
    const onBlur = jest.fn();
    const { ref, input } = renderSearchInput({
      onBlurFunction: onBlur,
      shouldDelayBlur: false,
    });
    ref.current = makeNativeInput({ focused: false });

    act(() => input().props.onBlur());
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('does not throw when blurring without an onBlurFunction', () => {
    const { ref, input } = renderSearchInput();
    ref.current = makeNativeInput({ focused: false });
    expect(() => act(() => input().props.onBlur())).not.toThrow();
  });

  test('does not run a delayed onBlurFunction after unmount', () => {
    const onBlur = jest.fn();
    const { ref, input, unmount } = renderSearchInput({
      onBlurFunction: onBlur,
    });
    ref.current = makeNativeInput({ focused: false });

    act(() => input().props.onBlur());
    unmount();
    advance(BLUR_DELAY_MS + 50);

    expect(onBlur).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Keyboard listeners
// ---------------------------------------------------------------------------

describe('CustomSearchInput - keyboard listeners', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  test('fires onBlur when keyboard hides for a focus session that had shown a keyboard', () => {
    const onBlur = jest.fn();
    const { ref, input } = renderSearchInput({ onBlurFunction: onBlur });
    // Native input has already lost focus (e.g. user dismissed the keyboard).
    ref.current = makeNativeInput({ focused: false });

    act(() => input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    setKeyboardVisible(false);
    fireKeyboard('keyboardDidHide', { duration: 250 });
    advance(BLUR_DELAY_MS + 50);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('ignores a keyboardDidHide when no keyboard showed for the current focus session', () => {
    const onBlur = jest.fn();
    const { ref, input } = renderSearchInput({ onBlurFunction: onBlur });
    ref.current = makeNativeInput({ focused: false });

    act(() => input().props.onFocus());
    // No keyboardDidShow this session.
    fireKeyboard('keyboardDidHide', { duration: 250 });
    advance(BLUR_DELAY_MS + 50);

    expect(onBlur).not.toHaveBeenCalled();
  });

  test('ignores a keyboardDidHide when the input is not focused', () => {
    const onBlur = jest.fn();
    const { ref } = renderSearchInput({ onBlurFunction: onBlur });
    ref.current = makeNativeInput({ focused: false });

    fireKeyboard('keyboardDidHide', { duration: 250 });
    advance(BLUR_DELAY_MS + 50);

    expect(onBlur).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Android blur confirmation (the "multiple keyboards" handling)
// ---------------------------------------------------------------------------

describe('CustomSearchInput - Android blur confirmation', () => {
  beforeEach(() => {
    Platform.OS = 'android';
  });

  test('confirms and fires onBlur when the keyboard is gone after the back gesture', () => {
    const onBlur = jest.fn();
    const { ref, input } = renderSearchInput({ onBlurFunction: onBlur });
    ref.current = makeNativeInput({ focused: false });

    act(() => input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    act(() => input().props.onBlur());
    expect(onBlur).not.toHaveBeenCalled();

    // Keyboard actually hides during the confirmation window.
    setKeyboardVisible(false);
    advance(ANDROID_BLUR_CONFIRMATION_MS + BLUR_DELAY_MS + 50);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('cancels the blur when the keyboard stays visible and the input is still focused', () => {
    const onBlur = jest.fn();
    const { ref, input } = renderSearchInput({ onBlurFunction: onBlur });
    ref.current = makeNativeInput({ focused: true });

    act(() => input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    act(() => input().props.onBlur());
    // Keyboard stays up, input keeps focus -> back gesture preview, not a blur.
    advance(ANDROID_BLUR_CONFIRMATION_MS + BLUR_DELAY_MS + 50);

    expect(onBlur).not.toHaveBeenCalled();
  });

  test('fires onBlur immediately when focus moves to another input', () => {
    const onBlur = jest.fn();
    const { ref, input } = renderSearchInput({ onBlurFunction: onBlur });
    ref.current = makeNativeInput({ focused: false });

    act(() => input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    // Another input is now the focused input; the keyboard stays up for it.
    TextInput.State.currentlyFocusedInput.mockReturnValue({ other: true });

    act(() => input().props.onBlur());
    advance(ANDROID_BLUR_CONFIRMATION_MS + BLUR_DELAY_MS + 50);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('skips the confirmation path when no keyboard was ever involved', () => {
    const onBlur = jest.fn();
    const { ref, input } = renderSearchInput({ onBlurFunction: onBlur });
    ref.current = makeNativeInput({ focused: false });

    // No focus, no keyboardDidShow, keyboard not visible.
    act(() => input().props.onBlur());
    advance(BLUR_DELAY_MS + 50);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// autoFocus
// ---------------------------------------------------------------------------

describe('CustomSearchInput - autoFocus', () => {
  test('focuses the input after AUTO_FOCUS_DELAY_MS when autoFocus and editable', () => {
    const { ref } = renderSearchInput({ autoFocus: true, editable: true });
    ref.current = makeNativeInput({ focused: false });

    advance(AUTO_FOCUS_DELAY_MS);
    expect(ref.current.focus).toHaveBeenCalledTimes(1);
  });

  test('does not auto-focus when not editable', () => {
    const { ref } = renderSearchInput({ autoFocus: true, editable: false });
    ref.current = makeNativeInput({ focused: false });

    advance(AUTO_FOCUS_DELAY_MS + 50);
    expect(ref.current.focus).not.toHaveBeenCalled();
  });

  test('does not re-focus an already focused input', () => {
    const { ref } = renderSearchInput({ autoFocus: true, editable: true });
    ref.current = makeNativeInput({ focused: true });

    advance(AUTO_FOCUS_DELAY_MS);
    expect(ref.current.focus).not.toHaveBeenCalled();
  });

  test('does not auto-focus if unmounted before the delay', () => {
    const { ref, unmount } = renderSearchInput({
      autoFocus: true,
      editable: true,
    });
    // Hold a reference: react-test-renderer nulls ref.current on unmount.
    const nativeInput = makeNativeInput({ focused: false });
    ref.current = nativeInput;

    unmount();
    advance(AUTO_FOCUS_DELAY_MS + 50);

    expect(nativeInput.focus).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cleanup on unmount
// ---------------------------------------------------------------------------

describe('CustomSearchInput - cleanup', () => {
  test('removes all keyboard listeners on unmount', () => {
    const { unmount } = renderSearchInput();
    // keyboardDidShow / keyboardWillShow / keyboardWillHide / keyboardDidHide
    expect(mockKB.subscriptions).toHaveLength(4);

    unmount();
    mockKB.subscriptions.forEach(subscription => {
      expect(subscription.remove).toHaveBeenCalledTimes(1);
    });
  });

  test('removes the AppState listener on unmount', () => {
    const { unmount } = renderSearchInput();
    expect(appStateSubscriptions).toHaveLength(1);
    unmount();
    expect(appStateSubscriptions[0].remove).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Multiple mounted instances (the real "multiple keyboards alive at once")
//
// React Navigation keeps previous screens mounted, so several
// CustomSearchInput instances are alive simultaneously. KeyboardEvents and
// AppState are global, so a SINGLE keyboard / app transition fans out to every
// instance's listeners. Each instance must only act on events that belong to
// its own focus session.
// ---------------------------------------------------------------------------

describe('CustomSearchInput - multiple mounted instances', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  test('a single keyboard event fans out to every mounted instance', () => {
    renderSearchInput({ placeholderText: 'Search added contacts' });
    renderSearchInput({ placeholderText: 'Enter address' });

    // Two instances => two handlers registered for the same global event.
    expect(mockKB.listeners.keyboardDidShow).toHaveLength(2);
    expect(appStateHandlers).toHaveLength(2);
  });

  test('keyboard shown for the focused input does not blur a different unfocused instance', () => {
    const onBlurContacts = jest.fn();
    const onBlurAddress = jest.fn();
    const contacts = renderSearchInput({
      placeholderText: 'Search added contacts',
      onBlurFunction: onBlurContacts,
    });
    const address = renderSearchInput({
      placeholderText: 'Enter address',
      onBlurFunction: onBlurAddress,
    });
    contacts.ref.current = makeNativeInput({ focused: false });
    address.ref.current = makeNativeInput({ focused: false });

    // Only the address input is focused; its keyboard shows. Both instances
    // receive the global event (matches the logs: contacts isFocusedRef:false,
    // address isFocusedRef:true).
    act(() => address.input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    // Keyboard hides -> both instances receive keyboardDidHide.
    setKeyboardVisible(false);
    fireKeyboard('keyboardDidHide', { duration: 250 });
    advance(BLUR_DELAY_MS + 50);

    expect(onBlurContacts).not.toHaveBeenCalled();
    expect(onBlurAddress).toHaveBeenCalledTimes(1);
  });

  test('on foreground only the focused instance reconciles; background instances stay quiet', () => {
    const onBlurContacts = jest.fn();
    const onBlurAddress = jest.fn();
    const contacts = renderSearchInput({
      placeholderText: 'Search added contacts',
      onBlurFunction: onBlurContacts,
    });
    const address = renderSearchInput({
      placeholderText: 'Enter address',
      onBlurFunction: onBlurAddress,
    });
    contacts.ref.current = makeNativeInput({ focused: false });
    address.ref.current = makeNativeInput({ focused: true });

    act(() => address.input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    // App backgrounded (no keyboardDidHide) then foregrounded, keyboard gone.
    setKeyboardVisible(false);
    fireAppState('active');
    advance(APP_ACTIVE_KEYBOARD_CHECK_DELAY_MS + BLUR_DELAY_MS + 50);

    expect(onBlurContacts).not.toHaveBeenCalled();
    expect(onBlurAddress).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Focus acquired while the keyboard is already up. When focus transfers from
// one input to another the keyboard never hides, so NO keyboardDidShow fires
// for the newly focused input. focusFunction records that the keyboard is
// already this input's, so its own keyboardDidHide is honored (not discarded
// as "stale" at searchInput.js:370) and onBlur still runs.
// ---------------------------------------------------------------------------

describe('CustomSearchInput - focus while keyboard already visible', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  test('honors keyboardDidHide for an input focused while the keyboard was already up', () => {
    const onBlur = jest.fn();
    // Keyboard is already visible at mount/focus time (transferred from another
    // input), so no keyboardDidShow event arrives for this focus session.
    setKeyboardVisible(true);
    const { ref, input } = renderSearchInput({ onBlurFunction: onBlur });
    ref.current = makeNativeInput({ focused: false });

    act(() => input().props.onFocus());
    // No keyboardDidShow (keyboard never transitioned).

    setKeyboardVisible(false);
    fireKeyboard('keyboardDidHide', { duration: 250 });
    advance(BLUR_DELAY_MS + 50);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Stress: many instances alive at once with chaotic, interleaved events.
// The invariant under all of these: a global keyboard/app event only ever
// drives the ONE instance that owns the current focus session; every other
// mounted instance stays inert, and no instance ever double-fires onBlur.
// ---------------------------------------------------------------------------

describe('CustomSearchInput - stress: many concurrent instances', () => {
  const expectOnlyFired = (instances, firedIndexes) => {
    instances.forEach(instance => {
      if (firedIndexes.includes(instance.index)) {
        expect(instance.onBlur).toHaveBeenCalledTimes(1);
      } else {
        expect(instance.onBlur).not.toHaveBeenCalled();
      }
    });
  };

  test('5 instances, one focused: a global show/hide blurs only the focused one', () => {
    Platform.OS = 'ios';
    const instances = renderInstances(5);
    const focused = instances[3];

    act(() => focused.input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    setKeyboardVisible(false);
    fireKeyboard('keyboardDidHide', { duration: 250 });
    advance(BLUR_DELAY_MS + 50);

    expectOnlyFired(instances, [3]);
  });

  test('5 instances: a flickering keyboard (show/hide/show/hide) blurs the focused one exactly once', () => {
    Platform.OS = 'ios';
    const instances = renderInstances(5);
    const focused = instances[2];

    act(() => focused.input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    // Rapid flicker, no timer advance between events.
    setKeyboardVisible(false);
    fireKeyboard('keyboardDidHide', { duration: 250 });
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });
    setKeyboardVisible(false);
    fireKeyboard('keyboardDidHide', { duration: 250 });
    advance(BLUR_DELAY_MS + 50);

    expectOnlyFired(instances, [2]);
  });

  test('5 instances: focus handoff chain blurs each instance exactly once as it loses focus', () => {
    Platform.OS = 'ios';
    const instances = renderInstances(5);

    // Focus the first; keyboard comes up (global event reaches all 5).
    act(() => instances[0].input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    // Hand focus down the chain. The keyboard stays up the whole time; each
    // previous input loses native focus (onBlur) as the next gains it.
    for (let i = 1; i < instances.length; i++) {
      act(() => instances[i - 1].input().props.onBlur());
      act(() => instances[i].input().props.onFocus());
    }

    // Finally the last focused input is dismissed and the keyboard hides.
    act(() => instances[4].input().props.onBlur());
    setKeyboardVisible(false);
    fireKeyboard('keyboardDidHide', { duration: 250 });
    advance(BLUR_DELAY_MS + 50);

    instances.forEach(instance => {
      expect(instance.onBlur).toHaveBeenCalledTimes(1);
    });
  });

  test('5 instances: an input focused while the keyboard is already up is the only one blurred on hide', () => {
    Platform.OS = 'ios';
    const instances = renderInstances(5);

    // Keyboard already up before anything here is focused (owned elsewhere).
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    // Now one of the five takes focus while the keyboard is already up.
    act(() => instances[1].input().props.onFocus());

    setKeyboardVisible(false);
    fireKeyboard('keyboardDidHide', { duration: 250 });
    advance(BLUR_DELAY_MS + 50);

    expectOnlyFired(instances, [1]);
  });

  test('5 instances: returning to foreground reconciles only the focused instance', () => {
    Platform.OS = 'ios';
    const instances = renderInstances(5);
    const focused = instances[4];
    focused.ref.current = makeNativeInput({ focused: true });

    act(() => focused.input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    // Backgrounded (no keyboardDidHide), then foregrounded with keyboard gone.
    setKeyboardVisible(false);
    fireAppState('active');
    advance(APP_ACTIVE_KEYBOARD_CHECK_DELAY_MS + BLUR_DELAY_MS + 50);

    expectOnlyFired(instances, [4]);
  });

  test('unmounting several instances mid-sequence leaves the rest behaving correctly', () => {
    Platform.OS = 'ios';
    const instances = renderInstances(5);
    const focused = instances[1];

    act(() => focused.input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    // Tear down two unrelated, unfocused instances mid-flight.
    instances[3].unmount();
    instances[4].unmount();

    setKeyboardVisible(false);
    fireKeyboard('keyboardDidHide', { duration: 250 });
    advance(BLUR_DELAY_MS + 50);

    expect(focused.onBlur).toHaveBeenCalledTimes(1);
    // Surviving unfocused instances stay inert; unmounted ones never fire.
    [0, 2, 3, 4].forEach(i => {
      expect(instances[i].onBlur).not.toHaveBeenCalled();
    });
  });

  test('Android: blur confirmation across many instances fires only for the input focus moved away from', () => {
    Platform.OS = 'android';
    const instances = renderInstances(5);
    const from = instances[0];
    const to = instances[1];

    act(() => from.input().props.onFocus());
    setKeyboardVisible(true);
    fireKeyboard('keyboardDidShow', { duration: 250 });

    // Back-gesture blur on `from` (deferred), then focus moves to `to` while
    // the keyboard stays up for it.
    act(() => from.input().props.onBlur());
    act(() => to.input().props.onFocus());
    TextInput.State.currentlyFocusedInput.mockReturnValue(to.ref.current);

    advance(ANDROID_BLUR_CONFIRMATION_MS + BLUR_DELAY_MS + 50);

    expectOnlyFired(instances, [0]);
  });
});
