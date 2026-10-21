import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';

// Text link button (D300, D299): 14/400 link, min height 44, optional trailing
// 16 glyph. `align` mirrors the frame's start alignment; `textStyle` overrides
// size where a frame draws 15 (D299).
export default function TextButton({
  text,
  onPress,
  icon,
  iconSize = 16,
  align = 'flex-start',
  textStyle,
  accessibilityLabel,
  paddingHorizontal = 4,
  disabled,
  testID,
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || text}
      style={[styles.button, { alignSelf: align, paddingHorizontal }]}
    >
      <ThemeText
        content={text}
        styles={[styles.text, { color: tokens.link }, textStyle]}
      />
      {!!icon && (
        <ThemeIcon
          redesign
          iconName={icon}
          size={iconSize}
          colorOverride={tokens.link}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    flexShrink: 1,
  },
});
