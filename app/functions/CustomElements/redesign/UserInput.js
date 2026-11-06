import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import CustomSearchInput from '../searchInput';
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
  onSubmitEditing,
  focusRing = false,
  keyboardType,
  multiline = false,
  forceSheet,
  right,
}) {
  const { tokens } = useTheme();
  const inSheet = useInSheet();
  const [isFocused, setIsFocused] = useState(false);
  const [rightWidth, setRightWidth] = useState(0);
  const isOverLimit = value?.length >= maxLength;
  const characterCountColor = isOverLimit ? tokens.danger : tokens.muted;
  const handleRightLayout = useCallback(layout => {
    setRightWidth(layout.nativeEvent.layout.width + 10);
  }, []);
  return (
    <View>
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
          textAlignVertical={multiline ? 'top' : 'center'}
          textInputMultiline={multiline}
          autoFocus={autoFocus}
          maxLength={maxLength}
          onSubmitEditingFunction={onSubmitEditing}
          textInputStyles={{
            ...styles.input,
            ...(pill && styles.pill),
            ...(multiline && styles.multiline),
            ...(focusRing && {
              borderWidth: 2,
              borderColor: isFocused
                ? isOverLimit
                  ? characterCountColor
                  : tokens.accent
                : 'transparent',
            }),
            color: inSheet || forceSheet ? tokens.ink : tokens.onField,
            backgroundColor:
              inSheet || forceSheet ? tokens.ground : tokens.field,
            ...(!!right && { height: 56, paddingRight: rightWidth }),
          }}
          keyboardType={keyboardType}
        />
        {!!right && (
          <View
            onLayout={handleRightLayout}
            style={{
              height: '100%',
              position: 'absolute',
              right: 5,
              justifyContent: 'center',
            }}
          >
            {right}
          </View>
        )}
      </View>
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
  },
  pill: { borderRadius: 999 },
  multiline: { height: 120, paddingTop: 14, paddingBottom: 14 },
});
