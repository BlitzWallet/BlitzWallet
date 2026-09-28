import { useGlobalThemeContext } from '../../../context-store/theme';
import { useMemo } from 'react';
import { Image } from 'expo-image';
import { COLORS } from '../../constants';
import { tintStyle } from '../webTintColor';

export default function ThemeImage({
  imgName,
  styles,
  isSVG,
  lightModeIcon,
  lightsOutIcon,
  darkModeIcon,
  source,
  disableTint = false,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();

  const tintColor = useMemo(() => {
    if (disableTint) return undefined;

    if (theme) {
      // Dark mode enabled
      return darkModeType ? COLORS.darkModeText : COLORS.primary;
    }
    // Light mode
    return COLORS.primary;
  }, [theme, darkModeType, disableTint]);

  const imageStyles = useMemo(() => {
    const baseStyles = { width: 30, height: 30 };

    // Add tintColor to styles only if we are using new format
    if (tintColor && source) baseStyles.tintColor = tintColor;

    const merged = Array.isArray(styles)
      ? styles.reduce((acc, style) => ({ ...acc, ...(style || {}) }), baseStyles)
      : { ...baseStyles, ...styles };

    // Convert the winning tintColor (internal or from `styles`) for web.
    if (merged.tintColor) {
      const color = merged.tintColor;
      delete merged.tintColor;
      Object.assign(merged, tintStyle(color));
    }
    return merged;
  }, [styles, tintColor, source]);
  const imageSource = useMemo(() => {
    if (source) return source;
    return theme
      ? darkModeType
        ? lightsOutIcon
        : darkModeIcon
      : lightModeIcon;
  }, [source, theme, darkModeType, lightsOutIcon, darkModeIcon, lightModeIcon]);
  return (
    <Image
      style={imageStyles}
      source={imageSource}
      recyclingKey={String(imageSource)}
    />
  );
}
