import { createContext, useContext, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

// Provided by the half modal shell: its drag-to-close pan and a flag that
// holds the sheet still while the touched list is scrolled away from the top.
export const SheetDragContext = createContext(null);

// iOS bounces ScrollViews (vertical and horizontal) even when their content fits, so the page
// looks scrollable when it isn't. Only bounce when content overflows, except
// with a refreshControl, where pull-to-refresh needs the bounce on short content.
// React 19 passes `ref` as a regular prop, so it reaches ScrollView via the spread.
export default function CustomScrollView(props) {
  const sheetDrag = useContext(SheetDragContext);
  const offset = useSharedValue(0);
  const touching = useSharedValue(false);
  const inSheet = !!sheetDrag && !props.horizontal;

  const nativeGesture = useMemo(() => {
    if (!inSheet) return null;
    const { panGesture, scrollBlocksDrag } = sheetDrag;
    return Gesture.Native()
      .simultaneousWithExternalGesture(panGesture)
      .onBegin(() => {
        touching.value = true;
        scrollBlocksDrag.value = offset.value > 0;
      })
      .onFinalize(() => {
        touching.value = false;
        scrollBlocksDrag.value = false;
      });
  }, [inSheet, sheetDrag]);

  if (!inSheet) {
    return (
      <ScrollView
        alwaysBounceVertical={!!props.refreshControl}
        alwaysBounceHorizontal={false}
        // Off by default; a caller can still pass it (or true) to show a bar.
        // Must stay above the spread so an explicit prop wins.
        showsVerticalScrollIndicator={false}
        {...props}
      />
    );
  }

  const onScroll = e => {
    const y = e.nativeEvent.contentOffset.y;
    offset.value = y;
    if (touching.value) sheetDrag.scrollBlocksDrag.value = y > 0;
    props.onScroll?.(e);
  };

  // No top bounce in a sheet: pulling down at the top drags the sheet instead.
  return (
    <GestureDetector gesture={nativeGesture}>
      <ScrollView
        alwaysBounceVertical={!!props.refreshControl}
        alwaysBounceHorizontal={false}
        bounces={!!props.refreshControl}
        scrollEventThrottle={16}
        // Off by default; a caller can still pass it (or true) to show a bar.
        // Must stay above the spread so an explicit prop wins.
        showsVerticalScrollIndicator={false}
        {...props}
        onScroll={onScroll}
      />
    </GestureDetector>
  );
}
