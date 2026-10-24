import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { useGlobalThemeContext } from '../../../context-store/theme';
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
  strokeWidth: strokeWidthProp,
  redesign = false,
}) {
  // Redesign icons (opt-in): stroke 1.75, ink (audit/SHARED.md icon row).
  const strokeWidth =
    strokeWidthProp !== undefined ? strokeWidthProp : redesign ? 1.75 : 2;
  const { theme, darkModeType, tokens } = useGlobalThemeContext();

  // Determine which icon to render based on theme
  const IconComponent = useMemo(() => {
    return loadIcon(iconName);
  }, [theme, darkModeType, iconName]);

  // Determine the color tint
  const iconColor = useMemo(() => {
    if (colorOverride) return colorOverride;
    if (redesign) return tokens.ink;
    if (theme) {
      return darkModeType ? tokens.ink : tokens.accent;
    }
    return tokens.accent;
  }, [theme, darkModeType, tokens, colorOverride, redesign]);

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
  // On react-native-web the icon renders as an <svg> element, where a CSS
  // `transform` rotates around the origin (0,0) instead of the center, so a
  // rotate like '180deg' moves the glyph out of its box and it disappears.
  if (Platform.OS === 'web' && iconStyles.transform) {
    const { transform, ...svgStyles } = iconStyles;
    return (
      <View style={{ transform }}>
        {fill ? (
          <IconComponent
            strokeWidth={strokeWidth}
            fill={fill}
            size={size}
            style={svgStyles}
          />
        ) : (
          <IconComponent
            strokeWidth={strokeWidth}
            size={size}
            style={svgStyles}
          />
        )}
      </View>
    );
  }

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
