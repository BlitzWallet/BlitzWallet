import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { COLORS, FONT } from '../../constants';
import ThemeText from './textTheme';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useInSheet } from './redesign/sheetSurface';

export default function FullLoadingScreen({
  text,
  containerStyles,
  reversed,
  textStyles,
  showLoadingIcon = true,
  size = 'large',
  loadingColor,
  showText = true,
}) {
  const { theme, tokens } = useGlobalThemeContext();
  // Sheets that load before they can show anything share one look
  // (System.dc.html "Loading in a sheet"): 56 ring + one 20/26 line.
  const inSheet = useInSheet();
  return (
    <View
      style={{
        ...styles.container,
        ...(inSheet && styles.sheetContainer),
        ...containerStyles,
      }}
    >
      {showLoadingIcon && (
        <ActivityIndicator
          color={
            loadingColor
              ? loadingColor
              : reversed
              ? theme
                ? COLORS.lightModeText
                : COLORS.darkModeText
              : tokens.ink
          }
          size={size}
        />
      )}
      {showText && (
        <ThemeText
          styles={{
            ...styles.text,
            ...(inSheet && { ...styles.sheetText, color: tokens.ink }),
            ...textStyles,
          }}
          content={text}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContainer: { paddingHorizontal: 12 },
  text: {
    marginTop: 10,
  },
  sheetText: {
    marginTop: 18,
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
