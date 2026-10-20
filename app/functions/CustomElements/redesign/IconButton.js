import { StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../context-store/theme';
import ThemeIcon from '../themeIcon';

// Round icon button. `label` is a required en key (O-5); size is also the
// touch target, so 44 is the minimum.
export default function IconButton({
  icon,
  label,
  size = 44,
  tone = 'white',
  onPress,
}) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tone === 'disc' ? tokens.disc : tokens.surface,
        },
      ]}
    >
      <ThemeIcon redesign iconName={icon} size={size === 64 ? 26 : 22} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
});
