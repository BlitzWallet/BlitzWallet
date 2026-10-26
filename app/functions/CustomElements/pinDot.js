import {StyleSheet} from 'react-native';
import {useEffect, useMemo, useRef} from 'react';
import GetThemeColors from '../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../context-store/theme';
import Animated, {
  useSharedValue,
  withTiming,
  withSequence,
  useAnimatedStyle,
} from 'react-native-reanimated';

// `redesign`: 14 pt dots, ink fill (audit/design Onboarding Create PIN).
export default function PinDot({dotNum, pin, redesign = false}) {
  const {theme} = useGlobalThemeContext();
  const isInitialLoad = useRef(true);

  const {textColor, tokens} = GetThemeColors();
  const dotScale = useSharedValue(1);

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
    }
    if (typeof pin[dotNum] === 'number') {
      dotScale.value = withSequence(
        withTiming(1.1, {duration: 100}),
        withTiming(1, {duration: 100}),
      );
    }
  }, [pin[dotNum], dotScale]);

  const memorizedStyles = useMemo(() => {
    if (typeof pin[dotNum] === 'number') {
      return {
        backgroundColor: redesign
          ? tokens.ink
          : theme
          ? textColor
          : tokens.accent,
      };
    } else {
      return {
        borderWidth: 2,
        borderColor: tokens.muted,
      };
    }
  }, [pin, dotNum, theme, tokens, redesign]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: dotScale.value}],
  }));

  return (
    <Animated.View
      style={[
        memorizedStyles,
        redesign ? styles.dotRedesign : styles.dot,
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  dotRedesign: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  dot_active: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
  },
});
