import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import CustomSearchInput from '../searchInput';
import ThemeIcon from '../themeIcon';
import { useInSheet } from './sheetSurface';

// CustomSearchInput (keeps its keyboard/blur handling) in the redesign field
// look: r16, 52 high, leading glyph, ground fill inside sheets (H8).
export default function SearchField({ value, onChangeText, placeholder }) {
  const { tokens } = useTheme();
  const inSheet = useInSheet();
  return (
    <CustomSearchInput
      inputText={value}
      setInputText={onChangeText}
      placeholderText={placeholder}
      placeholderTextColor={tokens.muted}
      textAlignVertical="center"
      textInputStyles={{
        ...styles.input,
        color: inSheet ? tokens.ink : tokens.onField,
        backgroundColor: inSheet ? tokens.ground : tokens.field,
      }}
      buttonComponent={
        <View pointerEvents="none" style={styles.glyph}>
          <ThemeIcon
            iconName="Search"
            size={20}
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
  glyph: { position: 'absolute', left: 16, top: 16 },
});
