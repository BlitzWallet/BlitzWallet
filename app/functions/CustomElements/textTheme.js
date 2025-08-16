import {StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT, SIZES} from '../../constants';
import {useGlobalThemeContext} from '../../../context-store/theme';
import {useCallback, useMemo} from 'react';

export default function ThemeText({
  content,
  styles,
  reversed,
  CustomEllipsizeMode = 'tail',
  CustomNumberOfLines = null,
  onLayout = null,
}) {
  const {theme} = useGlobalThemeContext();

  const memorizedStyles = useMemo(
    () => ({
      ...textStyles.localTextStyles,
      color: theme
        ? reversed
          ? COLORS.lightModeText
          : COLORS.darkModeText
        : reversed
        ? COLORS.darkModeText
        : COLORS.lightModeText,
      ...styles,
    }),
    [theme, styles],
  );

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
      ellipsizeMode={CustomEllipsizeMode}
      numberOfLines={CustomNumberOfLines}
      style={memorizedStyles}>
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
