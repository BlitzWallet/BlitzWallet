import {StyleSheet} from 'react-native';
import {useEffect, useMemo, useRef} from 'react';
import GetThemeColors from '../../hooks/themeColors';
import {COLORS} from '../../constants';
import {useGlobalThemeContext} from '../../../context-store/theme';
import Animated, {
  useSharedValue,
  withTiming,
  withSequence,
  useAnimatedStyle,
} from 'react-native-reanimated';

export default function PinDot({dotNum, pin}) {
  const {theme} = useGlobalThemeContext();
  const isInitialLoad = useRef(true);

  const {textColor, backgroundOffset} = GetThemeColors();
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
        backgroundColor: theme ? textColor : COLORS.primary,
      };
    } else {
      return {
        backgroundColor: backgroundOffset,
      };
    }
  }, [pin, dotNum, theme]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: dotScale.value}],
  }));

  return <Animated.View style={[memorizedStyles, styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  dot_active: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
  },
});
