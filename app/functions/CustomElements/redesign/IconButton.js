import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../context-store/theme';
import { SHADOWS } from '../../../constants/theme';
import ThemeIcon from '../themeIcon';

// Round icon button. `label` is a required en key (O-5); size is also the
// touch target, so 44 is the minimum. `tone="floating"` is the white button
// with a hairline ring used over the map.
export default function IconButton({
  icon,
  label,
  size = 44,
  tone = 'white',
  onPress,
  iconSize,
  iconColor,
  showActiveDot = false,
  activeOpacity = 0.2,
  testID,
}) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const floating = tone === 'floating';
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      activeOpacity={activeOpacity}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tone === 'disc' ? tokens.disc : tokens.surface,
        },
        floating && SHADOWS.ring,
      ]}
    >
      <ThemeIcon
        redesign
        iconName={icon}
        size={iconSize ?? (size === 64 ? 26 : 22)}
        colorOverride={iconColor}
      />
      {showActiveDot && (
        <View
          style={[
            styles.filterBadge,
            {
              backgroundColor: tokens.accent,
              borderColor: tokens.surface,
            },
          ]}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  filterBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 13,
    height: 13,
    borderRadius: 999,
    borderWidth: 2,
  },
});
