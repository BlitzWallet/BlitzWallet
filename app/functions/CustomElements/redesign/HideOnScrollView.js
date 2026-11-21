import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../../../../context-store/theme';
import CustomScrollView from '../scrollView';
import { CONTENT_KEYBOARD_OFFSET } from '../../../constants';

// ScrollView whose `header` (usually a SearchField) pins to the top and
// tracks the scroll 1:1: scrolling down pushes it up with the content,
// scrolling up pulls it back in. iOS rubber-band bounce at either end never
// moves it. Other props go to CustomScrollView (React 19 passes `ref` through
// the spread).
export default function HideOnScrollView({
  header,
  onScroll,
  children,
  ...props
}) {
  const { tokens } = useTheme();
  const offset = useSharedValue(0);
  const height = useRef(0);
  const hiddenBy = useRef(0);
  const lastY = useRef(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  const handleScroll = useCallback(
    e => {
      onScroll?.(e);
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      // Clamp to the real scroll range so iOS overscroll (and its spring-back)
      // at either end reads as zero movement, not a scroll up.
      const maxY = Math.max(0, contentSize.height - layoutMeasurement.height);
      const y = Math.min(Math.max(contentOffset.y, 0), maxY);
      const dy = y - lastY.current;
      lastY.current = y;
      // How far the header is pushed up, clamped to [0, its height].
      hiddenBy.current = Math.min(
        Math.max(hiddenBy.current + dy, 0),
        height.current,
      );
      offset.value = -hiddenBy.current;
    },
    [onScroll, offset],
  );

  return (
    <CustomScrollView
      scrollEventThrottle={16}
      {...props}
      stickyHeaderIndices={[0]}
      onScroll={handleScroll}
    >
      {/* The sticky child must stay a plain View: RN moves its style onto a
          wrapper and freezes it, which crashes on a Reanimated style.
          box-none lets taps reach rows under it once the header moves away. */}
      <View style={{ pointerEvents: 'box-none' }}>
        {/* Opaque so rows don't show through while it's pinned. */}
        <Animated.View
          onLayout={e => {
            height.current = e.nativeEvent.layout.height;
          }}
          style={[
            {
              backgroundColor: tokens.ground,
              paddingBottom: CONTENT_KEYBOARD_OFFSET,
            },
            animatedStyle,
          ]}
        >
          {header}
        </Animated.View>
      </View>
      {children}
    </CustomScrollView>
  );
}
