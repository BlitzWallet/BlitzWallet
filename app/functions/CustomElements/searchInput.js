import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { CENTER, COLORS, FONT, SIZES } from '../../constants';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import ThemeText from './textTheme';
import { HIDDEN_OPACITY } from '../../constants/theme';

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
  textAlignVertical,
  maxLength,
  placeholderTextColor,
  shouldDelayBlur = true,
  autoCapitalize = 'none',
  editable = true,
  autoFocus = false,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textInputColor, textInputBackground } = GetThemeColors();
  const isFocusedRef = useRef(false);
  const internalRef = useRef(null);
  const inputRef = textInputRef || internalRef;

  const memorizedStyles = useMemo(
    () => ({
      ...styles.searchInput,
      color: textInputColor,
      backgroundColor: textInputBackground,
      opacity: editable ? 1 : HIDDEN_OPACITY,
      ...textInputStyles,
    }),
    [theme, darkModeType, textInputStyles, editable],
  );

  const viewContainerStyles = useMemo(() => {
    return { ...styles.inputContainer, ...containerStyles };
  }, [containerStyles]);

  const keyboardAppearance = useMemo(() => {
    return theme ? 'dark' : 'light';
  }, [theme]);

  const placeholderTextColorStyles = useMemo(() => {
    return placeholderTextColor != undefined
      ? placeholderTextColor
      : theme && !darkModeType
      ? COLORS.blueDarkmodeTextInputPlaceholder
      : COLORS.opaicityGray;
  }, [theme, darkModeType, placeholderTextColor]);

  const placeholderStyles = useMemo(
    () => ({
      ...styles.searchInput,
      ...textInputStyles,
      flexShrink: 1,
      position: 'absolute',
      zIndex: 1,
      pointerEvents: 'none',
    }),
    [placeholderTextColorStyles, textInputStyles],
  );

  const placeholderTextStyle = useMemo(() => {
    return { color: placeholderTextColorStyles, includeFontPadding: false };
  }, [placeholderTextColorStyles]);

  const blurOnSubmitValue = useMemo(() => {
    return blurOnSubmit != undefined ? blurOnSubmit : true;
  }, [blurOnSubmit]);

  const mutlilineValue = useMemo(() => {
    return textInputMultiline != undefined ? textInputMultiline : false;
  }, [textInputMultiline]);

  const textAlignVerticalValue = useMemo(() => {
    return textAlignVertical != undefined ? textAlignVertical : 'center';
  }, [textAlignVertical]);

  const maxLenValue = useMemo(() => {
    return maxLength != undefined ? maxLength : undefined;
  }, [maxLength]);

  const submitEditingFunction = useCallback(() => {
    if (onSubmitEditingFunction) {
      onSubmitEditingFunction();
    }
  }, [onSubmitEditingFunction]);

  const focusFunction = useCallback(() => {
    isFocusedRef.current = true;
    if (onFocusFunction) {
      onFocusFunction();
    }
  }, [onFocusFunction]);

  const blurFunction = useCallback(() => {
    isFocusedRef.current = false;
    if (!onBlurFunction) return;
    if (shouldDelayBlur) {
      setTimeout(() => {
        onBlurFunction();
      }, 150);
    } else onBlurFunction();
  }, [onBlurFunction, shouldDelayBlur]);

  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        // Only trigger blur if input was focused
        if (isFocusedRef.current && onBlurFunction) {
          isFocusedRef.current = false;
          console.log(inputRef);
          if (inputRef?.current) {
            inputRef.current.blur();
          }
          if (shouldDelayBlur) {
            setTimeout(() => {
              onBlurFunction();
            }, 150);
          } else {
            onBlurFunction();
          }
        }
      },
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, [onBlurFunction, shouldDelayBlur]);

  const showPlaceholder = !inputText && placeholderText;

  return (
    <View style={viewContainerStyles}>
      {showPlaceholder && (
        <View
          style={{
            ...placeholderStyles,
            justifyContent:
              textAlignVerticalValue === 'top'
                ? 'flex-start'
                : textAlignVerticalValue === 'bottom'
                ? 'flex-end'
                : 'center',
          }}
        >
          <ThemeText
            styles={placeholderTextStyle}
            CustomNumberOfLines={1}
            content={placeholderText}
          />
        </View>
      )}
      <TextInput
        autoFocus={autoFocus}
        keyboardAppearance={keyboardAppearance}
        placeholder={''}
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
  },
  searchInput: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
    minHeight: 50,
  },
});
