import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, TextInput, View } from 'react-native';
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

// Editable OTP-style input: one transparent TextInput overlays `length` boxes so
// tapping anywhere focuses it. Filled boxes show the char; the active box shows a
// blinking caret. Read-only SAS boxes elsewhere are rendered separately.
export default function SegmentedCodeInput({
  value,
  onChangeText,
  length = 6,
  keyboardType = 'default',
  autoFocus = true,
}) {
  const { backgroundOffset, textColor } = GetThemeColors();
  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const caret = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(caret, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [caret]);

  const chars = value.split('');
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Pressable style={styles.row} onPress={() => inputRef.current?.focus()}>
      {Array.from({ length }).map((_, index) => {
        const isActive = isFocused && index === activeIndex;
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
                  { backgroundColor: COLORS.primary, opacity: caret },
                ]}
              />
            ) : null}
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={text => onChangeText(sanitizeCode(text, length))}
        maxLength={length}
        keyboardType={keyboardType}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus={autoFocus}
        caretHidden={true}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={[styles.hiddenInput, { color: textColor }]}
      />
    </Pressable>
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
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
});
