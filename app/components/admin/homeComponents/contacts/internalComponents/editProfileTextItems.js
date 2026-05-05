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
  showDivider = false,
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
    : textColor;

  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      activeOpacity={1}
      onPress={() => inputRef?.current?.focus()}
    >
      <View style={styles.labelRow}>
        <View style={styles.labelLeft}>
          <ThemeText styles={styles.label} content={label} />
          {showInfoIcon && (
            <TouchableOpacity onPress={onInfoPress} style={styles.infoIconWrap}>
              <ThemeIcon size={14} iconName="Info" />
            </TouchableOpacity>
          )}
        </View>
        <ThemeText
          styles={{
            fontSize: SIZES.xSmall,
            includeFontPadding: false,
            color: characterCountColor,
            opacity: isOverLimit ? 1 : 0.45,
          }}
          content={`${value.length} / ${maxLength}`}
        />
      </View>

      <TextInput
        keyboardAppearance={theme ? 'dark' : 'light'}
        placeholder={placeholder}
        placeholderTextColor={
          theme && !darkModeType
            ? COLORS.darkModePlaceholder
            : COLORS.lightModePlaceholder
        }
        ref={inputRef}
        editable={true}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.textInput,
          { color: inputTextColor },
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

      {showDivider && (
        <View style={[styles.divider, { backgroundColor: textColor }]} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  labelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: 0.55,
  },
  infoIconWrap: {
    marginLeft: 2,
    opacity: 0.55,
  },
  textInput: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
    backgroundColor: 'transparent',
    padding: 0,
  },
  divider: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: StyleSheet.hairlineWidth,
    opacity: 0.15,
  },
});
