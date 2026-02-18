import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT, SIZES } from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useCallback, useMemo } from 'react';

export default function ThemeText({
  content,
  styles,
  reversed,
  CustomEllipsizeMode = 'tail',
  CustomNumberOfLines = null,
  onLayout = null,
  onTextLayout = null,
  adjustsFontSizeToFit = false,
  minimumFontScale = 0.5,
}) {
  const { theme } = useGlobalThemeContext();

  const memorizedStyles = useMemo(() => {
    // Base styles with theme color
    const baseStyles = {
      ...textStyles.localTextStyles,
      color: theme
        ? reversed
          ? COLORS.lightModeText
          : COLORS.darkModeText
        : reversed
        ? COLORS.darkModeText
        : COLORS.lightModeText,
    };

    if (!styles) {
      return baseStyles;
    }

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
  }, [theme, reversed, styles]);

  const layoutCallback = useCallback(
    e => {
      if (!onLayout) return;
      onLayout(e);
    },
    [onLayout],
  );

  return (
    <Text
      onLayout={layoutCallback}
      onTextLayout={onTextLayout}
      ellipsizeMode={CustomEllipsizeMode}
      numberOfLines={CustomNumberOfLines}
      style={memorizedStyles}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={minimumFontScale}
    >
      {content}
    </Text>
  );
}

const textStyles = StyleSheet.create({
  localTextStyles: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.medium,
  },
});
