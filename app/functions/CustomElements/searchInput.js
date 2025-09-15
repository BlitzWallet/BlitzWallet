import {StyleSheet, TextInput, View} from 'react-native';
import {CENTER, COLORS, FONT, SIZES} from '../../constants';
import GetThemeColors from '../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../context-store/theme';
import {useCallback, useMemo} from 'react';
import ThemeText from './textTheme';

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
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textInputColor, textInputBackground} = GetThemeColors();
  const memorizedStyles = useMemo(
    () => ({
      ...styles.searchInput,
      color: textInputColor,
      backgroundColor: textInputBackground,
      ...textInputStyles,
    }),
    [theme, darkModeType, textInputStyles],
  );

  const viewContainerStyles = useMemo(() => {
    return {...styles.inputContainer, ...containerStyles};
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
    return {color: placeholderTextColorStyles, includeFontPadding: false};
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
    return maxLength != undefined ? maxLength : null;
  }, [maxLength]);
  const submitEditingFunction = useCallback(() => {
    if (onSubmitEditingFunction) {
      onSubmitEditingFunction();
    }
  }, [onSubmitEditingFunction]);
  const focusFunction = useCallback(() => {
    if (onFocusFunction) {
      onFocusFunction();
    }
  }, [onFocusFunction]);

  const blurFunction = useCallback(() => {
    if (!onBlurFunction) return;
    if (shouldDelayBlur) {
      setTimeout(() => {
        onBlurFunction();
      }, 150);
    } else onBlurFunction();
  }, [onBlurFunction, shouldDelayBlur]);
  const showPlaceholder = !inputText && placeholderText;

  return (
    <View style={viewContainerStyles}>
      {showPlaceholder && (
        <View
          style={{
            ...placeholderStyles,
            justifyContent: 'center',
          }}>
          <ThemeText
            styles={placeholderTextStyle}
            CustomNumberOfLines={1}
            content={placeholderText}
          />
        </View>
      )}
      <TextInput
        keyboardAppearance={keyboardAppearance}
        placeholder={''}
        placeholderTextColor={placeholderTextColorStyles}
        value={inputText}
        ref={textInputRef}
        onChangeText={setInputText}
        blurOnSubmit={blurOnSubmitValue}
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
  },
});
