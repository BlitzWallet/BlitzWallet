import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
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
      {showLoadingIcon &&
        (inSheet ? (
          <SheetSpinner tokens={tokens} />
        ) : (
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
        ))}
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

function SheetSpinner({ tokens }) {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
  }, [spin]);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={[{ width: 56, height: 56 }, spinnerStyle]}
    >
      <Svg width={56} height={56}>
        <Circle
          cx={28}
          cy={28}
          r={25.5}
          fill="none"
          stroke={tokens.divider}
          strokeWidth={5}
        />
        <Circle
          cx={28}
          cy={28}
          r={25.5}
          fill="none"
          stroke={tokens.accent}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray="160.2"
          strokeDashoffset={112.2}
        />
      </Svg>
    </Animated.View>
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
