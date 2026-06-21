import { AppState, Platform, StyleSheet, TextInput, View } from 'react-native';
import { CENTER, COLORS, FONT, SIZES } from '../../constants';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { HIDDEN_OPACITY } from '../../constants/theme';
import {
  KeyboardController,
  KeyboardEvents,
} from 'react-native-keyboard-controller';

const BLUR_DELAY_MS = 150;
const ANDROID_BLUR_CONFIRMATION_MS = 80;
const ANDROID_KEYBOARD_HIDDEN_CONFIRMATION_MS = 0;
const APP_ACTIVE_KEYBOARD_CHECK_DELAY_MS = 120;
const AUTO_FOCUS_DELAY_MS = 150;
const ENABLE_SEARCH_INPUT_DIAGNOSTICS = __DEV__;

function getKeyboardVisible() {
  const keyboardState = KeyboardController.state?.();
  return (
    KeyboardController.isVisible?.() ||
    (keyboardState?.height ?? 0) > 0 ||
    false
  );
}

function getFocusedInput() {
  try {
    return TextInput.State?.currentlyFocusedInput?.() || null;
  } catch {
    return null;
  }
}

function getNativeInputRef(input) {
  return input?.getNativeRef?.() || input;
}

function clearTimer(timerRef) {
  if (!timerRef.current) return;
  clearTimeout(timerRef.current);
  timerRef.current = null;
}

function logSearchInputDiagnostic(label, event, details = {}) {
  if (!ENABLE_SEARCH_INPUT_DIAGNOSTICS) return;

  console.log('[CustomSearchInput]', event, {
    label,
    keyboardValue: KeyboardController.isVisible?.(),
    ...details,
  });
}

export default function CustomSearchInput({
  inputText,
  setInputText,
  placeholderText = '',
  containerStyles,
  textInputStyles,
  buttonComponent,
  keyboardType = 'default',
  textInputRef,
  blurOnSubmit,
  onSubmitEditingFunction,
  onFocusFunction,
  onBlurFunction,
  textInputMultiline,
  textAlignVertical = 'top',
  maxLength,
  placeholderTextColor,
  shouldDelayBlur = true,
  autoCapitalize = 'none',
  editable = true,
  autoFocus = false,
  returnKeyType = 'default',
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textInputColor, textInputBackground } = GetThemeColors();
  const isFocusedRef = useRef(false);
  const isMountedRef = useRef(true);
  const keyboardVisibleRef = useRef(getKeyboardVisible());
  const keyboardShownForCurrentFocusRef = useRef(false);
  const pendingBlurRef = useRef(false);
  const blurDelayTimerRef = useRef(null);
  const blurConfirmationTimerRef = useRef(null);
  const keyboardHideTimerRef = useRef(null);
  const autoFocusTimerRef = useRef(null);
  const appStateTimerRef = useRef(null);
  const onBlurFunctionRef = useRef(onBlurFunction);
  const internalRef = useRef(null);
  const inputRef = textInputRef || internalRef;
  const diagnosticLabel = placeholderText || 'unlabeled';
  onBlurFunctionRef.current = onBlurFunction;

  const mutlilineValue = useMemo(() => {
    return textInputMultiline !== undefined ? textInputMultiline : false;
  }, [textInputMultiline]);

  const textAlignVerticalValue = useMemo(() => {
    return textAlignVertical !== undefined ? textAlignVertical : 'center';
  }, [textAlignVertical]);

  const memorizedStyles = useMemo(() => {
    const baseStyles = {
      ...styles.searchInput,
      color: textInputColor,
      backgroundColor: textInputBackground,
      opacity: editable ? 1 : HIDDEN_OPACITY,
      ...textInputStyles,
    };

    return baseStyles;
  }, [textInputStyles, editable, textInputColor, textInputBackground]);
  const viewContainerStyles = useMemo(() => {
    return { ...styles.inputContainer, ...containerStyles };
  }, [containerStyles]);

  const keyboardAppearance = useMemo(() => {
    return theme ? 'dark' : 'light';
  }, [theme]);

  const placeholderTextColorStyles = useMemo(() => {
    if (placeholderTextColor !== undefined) return placeholderTextColor;
    return theme && !darkModeType
      ? COLORS.darkModePlaceholder
      : COLORS.lightModePlaceholder;
  }, [theme, darkModeType, placeholderTextColor]);

  const blurOnSubmitValue = useMemo(() => {
    return blurOnSubmit !== undefined ? blurOnSubmit : true;
  }, [blurOnSubmit]);

  const maxLenValue = useMemo(() => {
    return maxLength !== undefined ? maxLength : undefined;
  }, [maxLength]);

  const submitEditingFunction = useCallback(() => {
    if (onSubmitEditingFunction) {
      onSubmitEditingFunction();
    }
  }, [onSubmitEditingFunction]);

  const focusFunction = useCallback(() => {
    clearTimer(blurConfirmationTimerRef);
    clearTimer(keyboardHideTimerRef);
    pendingBlurRef.current = false;
    keyboardShownForCurrentFocusRef.current = false;
    isFocusedRef.current = true;
    // If the keyboard is already up (focus transferred from another input),
    // no keyboardDidShow fires for this focus session. Record that the keyboard
    // is ours now so our own keyboardDidHide isn't discarded as stale.
    if (keyboardVisibleRef.current || getKeyboardVisible()) {
      keyboardShownForCurrentFocusRef.current = true;
    }
    logSearchInputDiagnostic(diagnosticLabel, 'TextInput onFocus', {
      keyboardVisible: keyboardVisibleRef.current || getKeyboardVisible(),
    });
    if (onFocusFunction) {
      onFocusFunction();
    }
  }, [diagnosticLabel, onFocusFunction]);

  const runBlurCallback = useCallback(
    source => {
      clearTimer(blurDelayTimerRef);
      pendingBlurRef.current = false;

      const currentOnBlurFunction = onBlurFunctionRef.current;
      if (!currentOnBlurFunction) return;

      const invokeBlurCallback = () => {
        blurDelayTimerRef.current = null;
        if (!isMountedRef.current) return;

        logSearchInputDiagnostic(diagnosticLabel, 'running onBlurFunction', {
          source,
          keyboardVisible: keyboardVisibleRef.current || getKeyboardVisible(),
        });
        currentOnBlurFunction();
      };

      if (shouldDelayBlur) {
        blurDelayTimerRef.current = setTimeout(
          invokeBlurCallback,
          BLUR_DELAY_MS,
        );
      } else {
        invokeBlurCallback();
      }
    },
    [diagnosticLabel, shouldDelayBlur],
  );

  const scheduleKeyboardHiddenBlur = useCallback(
    (source, options = {}) => {
      clearTimer(keyboardHideTimerRef);

      keyboardHideTimerRef.current = setTimeout(() => {
        keyboardHideTimerRef.current = null;

        if (!isMountedRef.current) return;

        const currentInput = inputRef.current;
        const nativeInput = getNativeInputRef(currentInput);
        const focusedInput = getFocusedInput();
        const isCurrentInputFocused =
          currentInput?.isFocused?.() ||
          focusedInput === currentInput ||
          focusedInput === nativeInput;
        const keyboardVisible =
          options.trustKeyboardVisible !== false ? getKeyboardVisible() : false;
        keyboardVisibleRef.current = keyboardVisible;

        logSearchInputDiagnostic(
          diagnosticLabel,
          'keyboard hidden confirmation',
          {
            source,
            keyboardVisible,
            isFocusedRef: isFocusedRef.current,
            pendingBlur: pendingBlurRef.current,
            nativeFocused: currentInput?.isFocused?.() || false,
            focusedInputMatchesCurrent: isCurrentInputFocused,
          },
        );

        if (keyboardVisible && isCurrentInputFocused) {
          pendingBlurRef.current = false;
          isFocusedRef.current = true;
          return;
        }

        if (keyboardVisible) return;

        if (pendingBlurRef.current) {
          runBlurCallback(source);
          return;
        }

        if (!isFocusedRef.current) return;

        isFocusedRef.current = false;
        if (inputRef.current?.isFocused?.()) {
          inputRef.current.blur();
          return;
        }

        runBlurCallback(source);
      }, ANDROID_KEYBOARD_HIDDEN_CONFIRMATION_MS);
    },
    [diagnosticLabel, inputRef, runBlurCallback],
  );

  const blurFunction = useCallback(() => {
    isFocusedRef.current = false;
    if (!onBlurFunctionRef.current) return;

    const keyboardVisible = keyboardVisibleRef.current || getKeyboardVisible();
    const shouldConfirmAndroidBlur =
      Platform.OS === 'android' &&
      (keyboardVisible || keyboardShownForCurrentFocusRef.current);

    logSearchInputDiagnostic(diagnosticLabel, 'TextInput onBlur', {
      keyboardVisible,
      keyboardShownForCurrentFocus: keyboardShownForCurrentFocusRef.current,
      nativeFocused: inputRef.current?.isFocused?.() || false,
    });

    if (shouldConfirmAndroidBlur) {
      pendingBlurRef.current = true;
      clearTimer(blurConfirmationTimerRef);

      blurConfirmationTimerRef.current = setTimeout(() => {
        blurConfirmationTimerRef.current = null;

        if (!pendingBlurRef.current || !isMountedRef.current) return;

        const currentInput = inputRef.current;
        const nativeInput = getNativeInputRef(currentInput);
        const focusedInput = getFocusedInput();
        const didFocusMoveToAnotherInput =
          !!focusedInput &&
          focusedInput !== currentInput &&
          focusedInput !== nativeInput;
        const inputIsFocused = currentInput?.isFocused?.() || false;
        const isKeyboardStillVisible = getKeyboardVisible();
        keyboardVisibleRef.current = isKeyboardStillVisible;

        logSearchInputDiagnostic(diagnosticLabel, 'Android blur confirmation', {
          didFocusMoveToAnotherInput,
          inputIsFocused,
          keyboardVisible: isKeyboardStillVisible,
          pendingBlur: pendingBlurRef.current,
        });

        if (isKeyboardStillVisible && inputIsFocused) {
          pendingBlurRef.current = false;
          isFocusedRef.current = true;
          return;
        }

        if (didFocusMoveToAnotherInput) {
          runBlurCallback('focus moved to another input');
          return;
        }

        if (!isKeyboardStillVisible) {
          scheduleKeyboardHiddenBlur('keyboard hidden after Android blur');
        }
      }, ANDROID_BLUR_CONFIRMATION_MS);
      return;
    }

    runBlurCallback('TextInput onBlur');
  }, [diagnosticLabel, inputRef, runBlurCallback, scheduleKeyboardHiddenBlur]);

  useEffect(() => {
    isMountedRef.current = true;

    const keyboardDidShowListener = KeyboardEvents.addListener(
      'keyboardDidShow',
      event => {
        keyboardVisibleRef.current = true;
        clearTimer(keyboardHideTimerRef);
        if (isFocusedRef.current) {
          keyboardShownForCurrentFocusRef.current = true;
        }
        logSearchInputDiagnostic(diagnosticLabel, 'keyboardDidShow', {
          eventDuration: event?.duration,
          isFocusedRef: isFocusedRef.current,
          pendingBlur: pendingBlurRef.current,
        });
      },
    );

    const keyboardWillShowListener = KeyboardEvents.addListener(
      'keyboardWillShow',
      event => {
        logSearchInputDiagnostic(diagnosticLabel, 'keyboardWillShow', {
          eventDuration: event?.duration,
        });
      },
    );

    const keyboardWillHideListener = KeyboardEvents.addListener(
      'keyboardWillHide',
      event => {
        logSearchInputDiagnostic(diagnosticLabel, 'keyboardWillHide', {
          eventDuration: event?.duration,
          pendingBlur: pendingBlurRef.current,
        });
      },
    );

    const keyboardDidHideListener = KeyboardEvents.addListener(
      'keyboardDidHide',
      event => {
        keyboardVisibleRef.current = false;

        logSearchInputDiagnostic(diagnosticLabel, 'keyboardDidHide', {
          eventDuration: event?.duration,
          isFocusedRef: isFocusedRef.current,
          pendingBlur: pendingBlurRef.current,
          nativeFocused: inputRef.current?.isFocused?.() || false,
        });

        if (pendingBlurRef.current) {
          scheduleKeyboardHiddenBlur('keyboardDidHide after pending blur');
          return;
        }

        if (!isFocusedRef.current) return;

        if (!keyboardShownForCurrentFocusRef.current) {
          logSearchInputDiagnostic(
            diagnosticLabel,
            'ignored stale keyboardDidHide',
            {
              reason: 'keyboard never showed for current focus session',
            },
          );
          return;
        }

        scheduleKeyboardHiddenBlur(
          'keyboardDidHide while focused ref was true',
        );
      },
    );

    return () => {
      isMountedRef.current = false;
      pendingBlurRef.current = false;
      clearTimer(blurDelayTimerRef);
      clearTimer(blurConfirmationTimerRef);
      clearTimer(keyboardHideTimerRef);
      clearTimer(autoFocusTimerRef);
      clearTimer(appStateTimerRef);
      keyboardDidShowListener.remove();
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
      keyboardDidHideListener.remove();
      logSearchInputDiagnostic(diagnosticLabel, 'unmount');
    };
  }, [diagnosticLabel, inputRef, runBlurCallback, scheduleKeyboardHiddenBlur]);

  useEffect(() => {
    const appStateListener = AppState.addEventListener('change', nextState => {
      clearTimer(appStateTimerRef);

      if (nextState !== 'active') return;

      appStateTimerRef.current = setTimeout(() => {
        appStateTimerRef.current = null;

        if (!isMountedRef.current) return;

        const keyboardVisible = getKeyboardVisible();
        keyboardVisibleRef.current = keyboardVisible;

        logSearchInputDiagnostic(diagnosticLabel, 'AppState active check', {
          keyboardVisible,
          isFocusedRef: isFocusedRef.current,
          pendingBlur: pendingBlurRef.current,
        });

        // Keyboard is genuinely back (or never hid) -> nothing to reconcile.
        // Without this guard, the trustKeyboardVisible:false call below would
        // fire a spurious blur even though the keyboard is still up.
        if (keyboardVisible) return;

        if (!pendingBlurRef.current && !isFocusedRef.current) return;

        pendingBlurRef.current = true;
        scheduleKeyboardHiddenBlur('AppState active with hidden keyboard', {
          trustKeyboardVisible: false,
        });
      }, APP_ACTIVE_KEYBOARD_CHECK_DELAY_MS);
    });

    return () => {
      clearTimer(appStateTimerRef);
      appStateListener.remove();
    };
  }, [diagnosticLabel, scheduleKeyboardHiddenBlur]);

  useEffect(() => {
    clearTimer(autoFocusTimerRef);

    if (!autoFocus || !editable) return undefined;

    autoFocusTimerRef.current = setTimeout(() => {
      autoFocusTimerRef.current = null;

      if (!isMountedRef.current || !autoFocus || !editable) return;

      const currentInput = inputRef.current;
      if (!currentInput || typeof currentInput.focus !== 'function') return;
      if (currentInput.isFocused?.()) return;

      currentInput.focus();
    }, AUTO_FOCUS_DELAY_MS);

    return () => {
      clearTimer(autoFocusTimerRef);
    };
  }, [autoFocus, editable, inputRef]);

  return (
    <View style={viewContainerStyles}>
      <TextInput
        autoFocus={false}
        keyboardAppearance={keyboardAppearance}
        placeholder={placeholderText}
        placeholderTextColor={placeholderTextColorStyles}
        value={inputText}
        ref={inputRef}
        onChangeText={setInputText}
        submitBehavior={blurOnSubmitValue ? 'blurAndSubmit' : undefined}
        keyboardType={keyboardType}
        onSubmitEditing={submitEditingFunction}
        onFocus={focusFunction}
        onBlur={blurFunction}
        multiline={mutlilineValue}
        textAlignVertical={textAlignVerticalValue}
        maxLength={maxLenValue}
        style={memorizedStyles}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={editable}
        returnKeyType={returnKeyType}
      />
      {buttonComponent && buttonComponent}
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    width: '100%',
    ...CENTER,
    alignItems: 'center',
    overflow: 'hidden',
  },
  searchInput: {
    width: '100%',
    paddingTop: 15,
    paddingBottom: 15,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 8,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },
});
