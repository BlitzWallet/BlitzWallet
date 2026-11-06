import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import CustomSearchInput from '../searchInput';
import ThemeIcon from '../themeIcon';
import { useInSheet } from './sheetSurface';

// CustomSearchInput (keeps its keyboard/blur handling) in the redesign field
// look: r16, 52 high, leading glyph, ground fill inside sheets (H8).
export default function SearchField({
  value,
  onChangeText,
  placeholder,
  pill = false,
  onFocus,
  onBlur,
  containerStyles,
  blurOnSubmit = true,
  onSubmitEditingFunction,
  autoFocus = false,
}) {
  const { tokens } = useTheme();
  const inSheet = useInSheet();
  return (
    <CustomSearchInput
      onFocusFunction={onFocus}
      onBlurFunction={onBlur}
      inputText={value}
      setInputText={onChangeText}
      placeholderText={placeholder}
      placeholderTextColor={tokens.muted}
      textAlignVertical="center"
      textInputStyles={{
        ...styles.input,
        ...(pill && styles.pill),
        color: inSheet ? tokens.ink : tokens.onField,
        backgroundColor: inSheet ? tokens.ground : tokens.field,
      }}
      containerStyles={containerStyles}
      blurOnSubmit={blurOnSubmit}
      onSubmitEditingFunction={onSubmitEditingFunction}
      autoFocus={autoFocus}
      buttonComponent={
        <View pointerEvents="none" style={styles.glyph}>
          <ThemeIcon
            iconName="Search"
            size={18}
            strokeWidth={1.75}
            colorOverride={tokens.muted}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderRadius: 16,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 48,
    paddingRight: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  pill: { borderRadius: 999 },
  glyph: { position: 'absolute', left: 16, top: 17 },
});
