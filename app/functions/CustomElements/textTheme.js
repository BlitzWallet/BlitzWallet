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
  allowFontScaling = true,
  variant,
}) {
  const { theme, tokens } = useGlobalThemeContext();

  const memorizedStyles = useMemo(() => {
    // Base styles with theme color
    const baseStyles = {
      ...textStyles.localTextStyles,
      ...(variant ? VARIANT_STYLES[variant] : null),
      color: reversed
        ? theme
          ? COLORS.lightModeText
          : COLORS.darkModeText
        : variant === 'hint'
        ? tokens.muted
        : tokens.ink,
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
  }, [theme, tokens, reversed, styles, variant]);

  const layoutCallback = useCallback(
    e => {
      if (!onLayout) return;
      onLayout(e);
    },
    [onLayout],
  );

  return (
    <Text
      allowFontScaling={allowFontScaling}
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

// Redesign type scale (audit/SHARED.md §1.2). Opt-in: no variant = today's
// style. Weight 500 only via fontFamily, never fontWeight (N-1).
const VARIANT_STYLES = {
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: 22,
    lineHeight: 28,
    includeFontPadding: false,
  },
  body: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  hint: {
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  note: {
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  amount: {
    fontFamily: FONT.Title_Medium,
    fontSize: 48,
    lineHeight: 56,
    includeFontPadding: false,
  },
};

const textStyles = StyleSheet.create({
  localTextStyles: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.medium,
  },
});
