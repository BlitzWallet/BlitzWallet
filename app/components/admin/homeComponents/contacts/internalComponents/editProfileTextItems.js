import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { FONT, TYPE } from '../../../../../constants';
import { ThemeText } from '../../../../../functions/CustomElements';

/**
 * Labelled field for the edit-contact form (People.dc.html "Edit contact"):
 * small uppercase label and a 52 input.
 *
 * @param {Object} props
 * @param {string} props.label - Label shown above the input
 * @param {string} props.placeholder - Placeholder text for input
 * @param {string} props.value - Current input value
 * @param {function} props.onChangeText - Callback when text changes
 * @param {function} props.onFocus - Callback when input is focused
 * @param {function} props.onBlur - Callback when input loses focus
 * @param {React.RefObject} props.inputRef - Ref for the TextInput
 * @param {number} props.maxLength - Maximum character length
 * @param {boolean} props.isFirst - First field: more space above the label
 * @param {Object} props.tokens - Theme tokens
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
  isFirst = false,
  tokens,
}) {
  const isOverLimit = value.length >= maxLength;

  return (
    <View style={[styles.container, isFirst && styles.first]}>
      <ThemeText
        styles={[styles.label, { color: tokens.muted }]}
        content={label}
      />

      <TextInput
        keyboardAppearance={tokens.scheme === 'dark' ? 'dark' : 'light'}
        placeholder={placeholder}
        placeholderTextColor={`${tokens.onField}A6`}
        ref={inputRef}
        editable={true}
        textAlignVertical="center"
        style={[
          styles.input,
          {
            backgroundColor: tokens.field,
            color: isOverLimit ? tokens.danger : tokens.onField,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        onFocus={onFocus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 20,
  },
  first: { marginTop: 24 },
  label: {
    marginHorizontal: 4,
    marginBottom: 8,
    ...TYPE.caption,
    letterSpacing: 0.48,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 0,
    fontSize: 16,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },
});
