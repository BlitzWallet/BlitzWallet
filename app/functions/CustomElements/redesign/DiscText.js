import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import { SIZES } from '../../../constants';

// Settings row lead disc: 36/40 grey disc with an 18 ink glyph (D279).
// `tone="danger"` = dangerBg + danger glyph (Delete wallet);
// `tone="primary"` = accent fill + onAccent glyph (D296 Ready to exit).
export default function DiscText({
  text,
  size = 36,
  tone = 'default',
  fontSize = SIZES.smedium,
}) {
  const { tokens } = useTheme();
  const danger = tone === 'danger';
  const primary = tone === 'primary';
  const white = tone === 'white';
  const background = danger
    ? tokens.dangerBg
    : primary
    ? tokens.accent
    : white
    ? tokens.surface
    : tokens.disc;
  const color = danger ? tokens.danger : primary ? tokens.onAccent : tokens.ink;
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
      <ThemeText styles={{ fontSize }} content={text} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
