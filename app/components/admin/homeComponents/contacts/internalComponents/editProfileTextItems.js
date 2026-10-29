import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { FONT } from '../../../../../constants';
import { ThemeText } from '../../../../../functions/CustomElements';

/**
 * Labelled field for the edit-contact form (People.dc.html "Edit contact"):
 * small uppercase label, a white 52 input (96 for the multiline bio) and an
 * optional "n / max" counter underneath.
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
 * @param {boolean} props.multiline - Whether input supports multiple lines
 * @param {boolean} props.showCount - Show the "n / max" counter
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
  multiline = false,
  showCount = false,
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
        placeholderTextColor={tokens.muted}
        ref={inputRef}
        editable={true}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.multiline,
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

      {showCount && (
        <ThemeText
          variant="hint"
          styles={[
            styles.count,
            { color: isOverLimit ? tokens.danger : tokens.muted },
          ]}
          content={`${value.length} / ${maxLength}`}
        />
      )}
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
    fontSize: 12,
    lineHeight: 16,
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
  multiline: {
    height: 96,
    paddingTop: 14,
    paddingBottom: 14,
    lineHeight: 24,
  },
  count: {
    marginHorizontal: 4,
    marginTop: 8,
  },
});
