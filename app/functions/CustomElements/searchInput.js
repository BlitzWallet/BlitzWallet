import { Keyboard, Platform, StyleSheet, TextInput, View } from 'react-native';
import { CENTER, COLORS, FONT, SIZES } from '../../constants';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { HIDDEN_OPACITY } from '../../constants/theme';

const BLUR_DELAY_MS = 150;
const ANDROID_BLUR_CONFIRMATION_MS = 80;
const AUTO_FOCUS_DELAY_MS = 150;
const ENABLE_SEARCH_INPUT_DIAGNOSTICS = __DEV__;

function getKeyboardVisible() {
  return Keyboard.isVisible?.() || false;
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
    keyboardValue: Keyboard.isVisible?.(),
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
  const onBlurFunctionRef = useRef(onBlurFunction);
  const internalRef = useRef(null);
  const inputRef = textInputRef || internalRef;
  const diagnosticLabel = placeholderText || 'unlabeled';
  onBlurFunctionRef.current = onBlurFunction;

  const mutlilineValue = useMemo(() => {
    return textInputMultiline != undefined ? textInputMultiline : false;
  }, [textInputMultiline]);

  const textAlignVerticalValue = useMemo(() => {
    return textAlignVertical != undefined ? textAlignVertical : 'center';
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
    if (placeholderTextColor != undefined) return placeholderTextColor;
    return theme && !darkModeType
      ? COLORS.darkModePlaceholder
      : COLORS.lightModePlaceholder;
  }, [theme, darkModeType, placeholderTextColor]);

  const blurOnSubmitValue = useMemo(() => {
    return blurOnSubmit != undefined ? blurOnSubmit : true;
  }, [blurOnSubmit]);

  const maxLenValue = useMemo(() => {
    return maxLength != undefined ? maxLength : undefined;
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
    source => {
      clearTimer(keyboardHideTimerRef);

      keyboardHideTimerRef.current = setTimeout(() => {
        keyboardHideTimerRef.current = null;

        if (!isMountedRef.current) return;

        const keyboardVisible =
          keyboardVisibleRef.current || getKeyboardVisible();
        logSearchInputDiagnostic(
          diagnosticLabel,
          'keyboard hidden confirmation',
          {
            source,
            keyboardVisible,
            isFocusedRef: isFocusedRef.current,
            pendingBlur: pendingBlurRef.current,
            nativeFocused: inputRef.current?.isFocused?.() || false,
          },
        );

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
      }, ANDROID_BLUR_CONFIRMATION_MS);
    },
    [diagnosticLabel, inputRef, runBlurCallback],
  );

  const blurFunction = useCallback(() => {
    isFocusedRef.current = false;
    if (!onBlurFunctionRef.current) return;

    const keyboardVisible = keyboardVisibleRef.current || getKeyboardVisible();
    logSearchInputDiagnostic(diagnosticLabel, 'TextInput onBlur', {
      keyboardVisible,
      nativeFocused: inputRef.current?.isFocused?.() || false,
    });

    if (Platform.OS === 'android' && keyboardVisible) {
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
        const isKeyboardStillVisible =
          keyboardVisibleRef.current || getKeyboardVisible();

        logSearchInputDiagnostic(diagnosticLabel, 'Android blur confirmation', {
          didFocusMoveToAnotherInput,
          inputIsFocused,
          keyboardVisible: isKeyboardStillVisible,
          pendingBlur: pendingBlurRef.current,
        });

        if (inputIsFocused) {
          pendingBlurRef.current = false;
          return;
        }

        if (didFocusMoveToAnotherInput || !isKeyboardStillVisible) {
          runBlurCallback(
            didFocusMoveToAnotherInput
              ? 'focus moved to another input'
              : 'keyboard hidden after Android blur',
          );
        }
      }, ANDROID_BLUR_CONFIRMATION_MS);
      return;
    }

    runBlurCallback('TextInput onBlur');
  }, [diagnosticLabel, inputRef, runBlurCallback]);

  useEffect(() => {
    isMountedRef.current = true;

    const keyboardDidShowListener = Keyboard.addListener(
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

    const keyboardWillShowListener = Keyboard.addListener(
      'keyboardWillShow',
      event => {
        logSearchInputDiagnostic(diagnosticLabel, 'keyboardWillShow', {
          eventDuration: event?.duration,
        });
      },
    );

    const keyboardWillHideListener = Keyboard.addListener(
      'keyboardWillHide',
      event => {
        logSearchInputDiagnostic(diagnosticLabel, 'keyboardWillHide', {
          eventDuration: event?.duration,
          pendingBlur: pendingBlurRef.current,
        });
      },
    );

    const keyboardDidHideListener = Keyboard.addListener(
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
      keyboardDidShowListener.remove();
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
      keyboardDidHideListener.remove();
      logSearchInputDiagnostic(diagnosticLabel, 'unmount');
    };
  }, [diagnosticLabel, inputRef, runBlurCallback, scheduleKeyboardHiddenBlur]);

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
