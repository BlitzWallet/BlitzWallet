import React from 'react';
import { StyleSheet, TouchableOpacity, TextInput, View } from 'react-native';
import { COLORS, FONT, SIZES } from '../../../../../constants';
import { ThemeText } from '../../../../../functions/CustomElements';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

/**
 * Reusable text input component for edit profile forms
 *
 * @param {Object} props
 * @param {string} props.label - Label text shown above input
 * @param {string} props.placeholder - Placeholder text for input
 * @param {string} props.value - Current input value
 * @param {function} props.onChangeText - Callback when text changes
 * @param {function} props.onFocus - Callback when input is focused
 * @param {function} props.onBlur - Callback when input loses focus
 * @param {React.RefObject} props.inputRef - Ref for the TextInput
 * @param {number} props.maxLength - Maximum character length
 * @param {boolean} props.multiline - Whether input supports multiple lines
 * @param {number} props.minHeight - Minimum height for multiline inputs
 * @param {number} props.maxHeight - Maximum height for multiline inputs
 * @param {boolean} props.theme - Dark mode enabled
 * @param {boolean} props.darkModeType - Dark mode type
 * @param {string} props.textInputColor - Text color
 * @param {string} props.textInputBackground - Background color
 * @param {string} props.textColor - Character count color
 * @param {boolean} props.showInfoIcon - Whether to show info icon
 * @param {function} props.onInfoPress - Callback when info icon is pressed
 * @param {Object} props.containerStyle - Additional container styles
 */
export default function EditProfileTextInput({
  label,
  placeholder,
  value = '',
  onChangeText,
  onFocus,
  onBlur,
  inputRef,
  maxLength = 30,
  multiline = false,
  minHeight,
  maxHeight,
  theme,
  darkModeType,
  textInputColor,
  textInputBackground,
  textColor,
  showInfoIcon = false,
  onInfoPress,
  containerStyle,
}) {
  const isOverLimit = value.length >= maxLength;
  const characterCountColor = isOverLimit
    ? theme && darkModeType
      ? textColor
      : COLORS.cancelRed
    : textColor;

  const inputTextColor = isOverLimit
    ? theme && darkModeType
      ? textInputColor
      : COLORS.cancelRed
    : textInputColor;

  return (
    <TouchableOpacity
      style={[styles.textInputContainer, containerStyle]}
      activeOpacity={1}
      onPress={() => {
        inputRef?.current?.focus();
      }}
    >
      {showInfoIcon ? (
        <TouchableOpacity onPress={onInfoPress} style={styles.usernameRow}>
          <ThemeText
            styles={styles.textInputContainerDescriptionText}
            content={label}
          />
          <View onPress={onInfoPress}>
            <ThemeIcon size={20} styles={styles.infoIcon} iconName={'Info'} />
          </View>
        </TouchableOpacity>
      ) : (
        <ThemeText
          styles={styles.textInputContainerDescriptionText}
          content={label}
        />
      )}

      <TextInput
        keyboardAppearance={theme ? 'dark' : 'light'}
        placeholder={placeholder}
        placeholderTextColor={COLORS.opaicityGray}
        ref={inputRef}
        editable={true}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.textInput,
          {
            backgroundColor: textInputBackground,
            color: inputTextColor,
            marginTop: showInfoIcon ? 0 : 8,
          },
          multiline && {
            minHeight: minHeight || 60,
            maxHeight: maxHeight || 100,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        onFocus={onFocus}
      />

      <ThemeText
        styles={{
          textAlign: 'right',
          color: characterCountColor,
        }}
        content={`${value.length} / ${maxLength}`}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  textInputContainer: {
    width: '100%',
  },
  textInputContainerDescriptionText: {
    includeFontPadding: false,
  },
  textInput: {
    fontSize: SIZES.medium,
    padding: 10,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
    borderRadius: 8,
    marginBottom: 10,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingRight: 10,
    paddingVertical: 8,
  },
  infoIcon: {
    width: 20,
    height: 20,
    marginLeft: 5,
  },
});
