import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import ThemeIcon from '../themeIcon';

// Settings row lead disc: 36/40 grey disc with an 18 ink glyph (D279).
// `tone="danger"` = dangerBg + danger glyph (Delete wallet).
export default function Disc({ icon, size = 36, iconSize = 18, tone = 'default' }) {
  const { tokens } = useTheme();
  const danger = tone === 'danger';
  return (
    <View
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: danger ? tokens.dangerBg : tokens.disc,
        },
      ]}
    >
      <ThemeIcon
        redesign
        iconName={icon}
        size={iconSize}
        colorOverride={danger ? tokens.danger : tokens.ink}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
