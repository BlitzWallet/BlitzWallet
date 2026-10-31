import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import ThemeIcon from '../themeIcon';

// Settings row lead disc: 36/40 grey disc with an 18 ink glyph (D279).
// `tone="danger"` = dangerBg + danger glyph (Delete wallet);
// `tone="primary"` = accent fill + onAccent glyph (D296 Ready to exit);
// `tone="accent"` = grey disc + accent glyph (alert dialog icon);
// `tone="whiteAccent"` = white disc + accent glyph (Launch.dc.html heroes).
export default function Disc({
  icon,
  size = 36,
  iconSize = 18,
  tone = 'default',
}) {
  const { tokens } = useTheme();
  const danger = tone === 'danger';
  const primary = tone === 'primary';
  const white = tone === 'white' || tone === 'whiteAccent';
  const warm = tone === 'warm';
  const background = danger
    ? tokens.dangerBg
    : primary
    ? tokens.accent
    : white
    ? tokens.surface
    : warm
    ? tokens.warnBg
    : tokens.disc;
  const color = danger
    ? tokens.danger
    : primary
    ? tokens.onAccent
    : tone === 'accent' || tone === 'whiteAccent'
    ? tokens.accent
    : warm
    ? tokens.warn
    : tokens.ink;
  return (
    <View
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
        },
      ]}
    >
      <ThemeIcon
        redesign
        iconName={icon}
        size={iconSize}
        colorOverride={color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
