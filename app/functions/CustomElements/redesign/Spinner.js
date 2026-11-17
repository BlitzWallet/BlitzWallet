import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../../../context-store/theme';

// The one indeterminate loader (D085): rotating ~30 % arc on a track.
// large = 56/5 (pages, sheets), small = 20/2.5 (buttons, rows, inline).
// Default: accent arc on the divider track. A custom arc colour without a
// track colour gets the arc at 20 % as track, so it reads on any fill.
// Keeps rotating under reduced motion: the motion is the message (chunk-0).
const SIZES = { large: [56, 5], small: [20, 2.5] };

export default function Spinner({
  size = 'large',
  strokeWidth,
  color,
  trackColor,
  accessibilityLabel,
  style,
}) {
  const { tokens } = useTheme();
  const [diameter, defaultStroke] =
    typeof size === 'number' ? [size, size / 8] : SIZES[size] || SIZES.large;
  const stroke = strokeWidth ?? defaultStroke;
  const arc = color || tokens.accent;
  const track = trackColor || (color ? undefined : tokens.divider);
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = diameter / 2;

  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rotation);
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={[{ width: diameter, height: diameter }, animatedStyle, style]}
    >
      <Svg width={diameter} height={diameter}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={track || arc}
          strokeOpacity={track ? 1 : 0.2}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={arc}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.7}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
    </Animated.View>
  );
}
