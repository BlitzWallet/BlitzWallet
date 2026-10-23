import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import CustomSearchInput from '../searchInput';
import ThemeIcon from '../themeIcon';
import { useInSheet } from './sheetSurface';
import ThemeText from '../textTheme';
import { SIZES } from '../../../constants';

// CustomSearchInput (keeps its keyboard/blur handling) in the redesign field
// look: r16, 52 high, leading glyph, ground fill inside sheets (H8), 2px
// accent ring while focused.
export default function UserInput({
  value,
  onChangeText,
  placeholder,
  pill = false,
  onFocus,
  onBlur,
  autoFocus,
  maxLength,
  showTextCount = false,
}) {
  const { tokens, mode } = useTheme();
  const inSheet = useInSheet();
  const [isFocused, setIsFocused] = useState(false);
  const isOverLimit = value?.length >= maxLength;
  const characterCountColor = isOverLimit
    ? mode === 'dim'
      ? tokens.muted
      : tokens.danger
    : tokens.muted;
  return (
    <View>
      <CustomSearchInput
        onFocusFunction={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlurFunction={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        inputText={value}
        setInputText={onChangeText}
        placeholderText={placeholder}
        placeholderTextColor={tokens.muted}
        textAlignVertical="center"
        autoFocus={autoFocus}
        maxLength={maxLength}
        textInputStyles={{
          ...styles.input,
          ...(pill && styles.pill),
          color: inSheet ? tokens.ink : tokens.onField,
          backgroundColor: inSheet ? tokens.ground : tokens.field,
        }}
      />
      {showTextCount && (
        <ThemeText
          styles={{
            textAlign: 'right',
            color: characterCountColor,
            marginTop: 5,
            fontSize: SIZES.smedium,
          }}
          content={`${value?.length} / ${maxLength}`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderRadius: 16,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 14,
    paddingRight: 14,
    fontSize: 15,
    lineHeight: 22,
  },
  pill: { borderRadius: 999 },
  glyph: { position: 'absolute', left: 16, top: 17 },
});
