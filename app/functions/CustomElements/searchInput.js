import {StyleSheet, TextInput, View} from 'react-native';
import {CENTER, COLORS, FONT, SIZES} from '../../constants';
import GetThemeColors from '../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../context-store/theme';
import {useMemo} from 'react';

export default function CustomSearchInput({
  inputText,
  setInputText,
  placeholderText,
  containerStyles,
  textInputStyles,
  buttonComponent,
  keyboardType,
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
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textInputColor, textInputBackground} = GetThemeColors();
  const memorizedStyles = useMemo(
    () => ({
      ...styles.searchInput,
      color: textInputColor,
      backgroundColor: textInputBackground,
    }),
    [theme, darkModeType],
  );
  return (
    <>
      <View style={{...styles.inputContainer, ...containerStyles}}>
        <TextInput
          keyboardAppearance={theme ? 'dark' : 'light'}
          placeholder={placeholderText || ''}
          placeholderTextColor={
            placeholderTextColor != undefined
              ? placeholderTextColor
              : theme && !darkModeType
              ? COLORS.blueDarkmodeTextInputPlaceholder
              : COLORS.opaicityGray
          }
          value={inputText}
          ref={textInputRef}
          onChangeText={setInputText}
          blurOnSubmit={blurOnSubmit != undefined ? blurOnSubmit : true}
          keyboardType={keyboardType || 'default'}
          onSubmitEditing={() => {
            onSubmitEditingFunction && onSubmitEditingFunction();
          }}
          onFocus={() => {
            onFocusFunction && onFocusFunction();
          }}
          onBlur={() => {
            if (!onBlurFunction) return;
            if (shouldDelayBlur) {
              setTimeout(() => {
                onBlurFunction();
              }, 150);
            } else onBlurFunction();
          }}
          multiline={
            textInputMultiline != undefined ? textInputMultiline : false
          }
          textAlignVertical={
            textAlignVertical != undefined ? textAlignVertical : 'center'
          }
          maxLength={maxLength != undefined ? maxLength : null}
          style={{
            ...memorizedStyles,
            ...textInputStyles,
          }}
        />
        {buttonComponent && buttonComponent}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    width: '100%',
    ...CENTER,
  },

  searchInput: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
    ...CENTER,
  },
});
