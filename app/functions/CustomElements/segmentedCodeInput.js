import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, FONT, SIZES } from '../../constants';
import GetThemeColors from '../../hooks/themeColors';
import ThemeText from './textTheme';

// Uppercases and truncates the raw input to `length`. Kept pure so the segmented
// rendering stays a straight map over the sanitized value.
export function sanitizeCode(text, length) {
  return String(text || '')
    .toUpperCase()
    .replace(/\s/g, '')
    .slice(0, length);
}

if (__DEV__) {
  // self-check: truncates to length and uppercases
  console.assert(sanitizeCode('ab12cdef', 6) === 'AB12CD', 'sanitizeCode');
  console.assert(sanitizeCode(' u u 8 ', 6) === 'UU8', 'sanitizeCode strip');
}

// Display-only OTP-style boxes: no TextInput and no native keyboard — the custom
// Blitz keyboard writes straight into `value`. The box at the next fill position
// shows the blinking caret.
export default function SegmentedCodeInput({ value, length = 6 }) {
  const { backgroundOffset } = GetThemeColors();
  const isFocused = useIsFocused();
  const caret = useSharedValue(1);

  // The caret loop runs on the UI thread; start it only once the screen has
  // finished navigating in so it doesn't fight the native-stack transition.
  useEffect(() => {
    if (!isFocused) return;
    caret.value = withRepeat(withTiming(0, { duration: 500 }), -1, true);
    return () => {
      caret.value = 1;
    };
  }, [caret, isFocused]);

  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.value }));

  const chars = value.split('');
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, index) => {
        const isActive = index === activeIndex;
        return (
          <View
            key={index}
            style={[
              styles.box,
              { backgroundColor: backgroundOffset },
              isActive && { borderColor: COLORS.primary, borderWidth: 2 },
            ]}
          >
            {chars[index] ? (
              <ThemeText styles={styles.boxText} content={chars[index]} />
            ) : isActive ? (
              <Animated.View
                style={[
                  styles.caret,
                  { backgroundColor: COLORS.primary },
                  caretStyle,
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  box: {
    width: 46,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: {
    fontSize: SIZES.xLarge,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },
  caret: {
    width: 2,
    height: 28,
    borderRadius: 2,
  },
});