import { useGlobalThemeContext } from '../../../context-store/theme';
import { useMemo } from 'react';
import { Image } from 'expo-image';
import { COLORS } from '../../constants';

export default function ThemeImage({
  imgName,
  styles,
  isSVG,
  lightModeIcon,
  lightsOutIcon,
  darkModeIcon,
  source,
  disableTint = false,
  contentFit = 'cover',
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
    const baseStyles = {
      width: 30,
      height: 30,
      ...styles,
    };

    // Add tintColor to styles only if we are using new format
    if (tintColor && source) {
      baseStyles.tintColor = tintColor;
    }

    if (!styles) return baseStyles;

    if (Array.isArray(styles)) {
      return styles.reduce(
        (acc, style) => ({
          ...acc,
          ...(style || {}),
        }),
        baseStyles,
      );
    }

    return {
      ...baseStyles,
      ...styles,
    };
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
      contentFit={contentFit}
    />
  );
}
