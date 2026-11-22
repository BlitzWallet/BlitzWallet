import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../../../../context-store/theme';
import CustomScrollView from '../scrollView';
import { CONTENT_KEYBOARD_OFFSET } from '../../../constants';

// A scroll view (or `ListComponent`: FlatList, SectionList…) with `header`
// (usually a SearchField) floating over its top. The header tracks the scroll
// 1:1: scrolling down pushes it up with the content, scrolling up pulls it
// back in. iOS rubber-band bounce at either end never moves it. The list gets
// top padding equal to the header so nothing starts underneath it. Other props
// go to the list (React 19 passes `ref` through the spread).
export default function HideOnScrollView({
  header,
  ListComponent = CustomScrollView,
  contentContainerStyle,
  onScroll,
  // Space above the header, for sitting below a TopHeader's fade (FADE_TOP).
  topInset = 0,
  ...props
}) {
  const { tokens } = useTheme();
  const offset = useSharedValue(0);
  const [height, setHeight] = useState(0);
  const heightRef = useRef(0);
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
        heightRef.current,
      );
      offset.value = -hiddenBy.current;
    },
    [onScroll, offset],
  );

  return (
    // Clips the header as it slides up, so it disappears under the edge
    // instead of over whatever sits above the list.
    <View style={styles.clip}>
      <ListComponent
        scrollEventThrottle={16}
        {...props}
        contentContainerStyle={[contentContainerStyle, { paddingTop: height }]}
        onScroll={handleScroll}
      />
      {/* Opaque so rows don't show through it. */}
      <Animated.View
        onLayout={e => {
          heightRef.current = e.nativeEvent.layout.height;
          setHeight(e.nativeEvent.layout.height);
        }}
        style={[
          styles.header,
          { backgroundColor: tokens.ground, paddingTop: topInset },
          animatedStyle,
        ]}
      >
        {header}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: 'hidden' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: CONTENT_KEYBOARD_OFFSET,
  },
});
