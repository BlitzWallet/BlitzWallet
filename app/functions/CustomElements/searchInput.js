import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { CENTER, COLORS, FONT, SIZES } from '../../constants';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  textAlignVertical = 'top',
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
    return placeholderTextColor != undefined
      ? placeholderTextColor
      : theme && !darkModeType
      ? COLORS.blueDarkmodeTextInputPlaceholder
      : COLORS.opaicityGray;
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

  return (
    <View style={viewContainerStyles}>
      <TextInput
        autoFocus={autoFocus}
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
