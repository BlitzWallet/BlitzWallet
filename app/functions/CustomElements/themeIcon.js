import { useMemo } from 'react';
import { useGlobalThemeContext } from '../../../context-store/theme';
import * as LucidIcons from 'lucide-react-native';
import { COLORS } from '../../constants';

export default function ThemeIcon({
  iconName,
  size = 30,
  styles,
  colorOverride,
  fill = null,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();

  // Determine which icon to render based on theme
  const IconComponent = useMemo(() => {
    return LucidIcons[iconName];
  }, [theme, darkModeType, iconName]);

  // Determine the color tint
  const iconColor = useMemo(() => {
    if (colorOverride) return colorOverride;
    if (theme) {
      return darkModeType ? COLORS.darkModeText : COLORS.primary;
    }
    return COLORS.primary;
  }, [theme, darkModeType, colorOverride]);

  // Merge styles
  const iconStyles = useMemo(() => {
    const baseStyles = { color: iconColor };

    if (!styles) return baseStyles;

    if (Array.isArray(styles)) {
      return styles.reduce(
        (acc, style) => ({ ...acc, ...(style || {}) }),
        baseStyles,
      );
    }

    return { ...baseStyles, ...styles };
  }, [styles, iconColor]);
  if (!IconComponent) return;
  if (fill) {
    return <IconComponent fill={fill} size={size} style={iconStyles} />;
  } else return <IconComponent size={size} style={iconStyles} />;
}
