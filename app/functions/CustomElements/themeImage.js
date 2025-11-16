import { useGlobalThemeContext } from '../../../context-store/theme';
import { useMemo } from 'react';
import { Image } from 'expo-image';

export default function ThemeImage({
  imgName,
  styles,
  isSVG,
  lightModeIcon,
  lightsOutIcon,
  darkModeIcon,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const imageStyles = useMemo(() => {
    const baseStyles = {
      width: 30,
      height: 30,
      ...styles,
    };

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
  }, [styles]);
  const imageSource = useMemo(() => {
    return theme
      ? darkModeType
        ? lightsOutIcon
        : darkModeIcon
      : lightModeIcon;
  }, [theme, darkModeType, lightsOutIcon, darkModeIcon, lightModeIcon]);
  return (
    <Image
      style={imageStyles}
      source={imageSource}
      recyclingKey={String(imageSource)}
    />
  );
}
