import { useMemo } from 'react';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { COLORS } from '../../constants';
import lucideIconFile from './lucideIconFile';
import lucideIcon from './lucideIcons';

function loadIcon(iconName) {
  const fileName = lucideIconFile(iconName);
  if (!fileName) return null;
  try {
    return lucideIcon(fileName);
  } catch {
    if (__DEV__) {
      console.warn(
        `ThemeIcon: no lucide icon for "${iconName}" (looked for ${fileName}.js)`,
      );
    }
    return null;
  }
}

export default function ThemeIcon({
  iconName,
  size = 30,
  styles,
  colorOverride,
  fill = null,
  strokeWidth = 2,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();

  // Determine which icon to render based on theme
  const IconComponent = useMemo(() => {
    return loadIcon(iconName);
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
    return (
      <IconComponent
        strokeWidth={strokeWidth}
        fill={fill}
        size={size}
        style={iconStyles}
      />
    );
  } else
    return (
      <IconComponent strokeWidth={strokeWidth} size={size} style={iconStyles} />
    );
}
