// Web shim for react-native-pager-view: a horizontal scroll-snap container
// exposing the imperative API (setPage/setPageWithoutAnimation) and
// onPageSelected. Used by the home screen and the balance carousel.
//
// ponytail: no onPageScroll worklet parity — the swipe-driven parallax/fade
// animation won't run on web (pages still swipe and snap correctly). Wire a
// real scroll-position event only if the animation is missed.
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  Children,
} from 'react';
import { ScrollView, View, StyleSheet, Dimensions } from 'react-native';

const PagerView = forwardRef(function PagerView(
  { children, initialPage = 0, onPageSelected, style, scrollEnabled = true },
  ref,
) {
  const scrollRef = useRef(null);
  const widthRef = useRef(Dimensions.get('window').width);
  const currentPage = useRef(initialPage);

  const scrollToPage = (page, animated) => {
    currentPage.current = page;
    scrollRef.current?.scrollTo({ x: page * widthRef.current, animated });
  };

  useImperativeHandle(ref, () => ({
    setPage: page => scrollToPage(page, true),
    setPageWithoutAnimation: page => scrollToPage(page, false),
  }));

  useEffect(() => {
    if (initialPage) scrollToPage(initialPage, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMomentumEnd = e => {
    const x = e.nativeEvent.contentOffset.x;
    const page = Math.round(x / widthRef.current);
    if (page !== currentPage.current) {
      currentPage.current = page;
    }
    onPageSelected?.({ nativeEvent: { position: page } });
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={style}
      horizontal
      pagingEnabled
      scrollEnabled={scrollEnabled}
      showsHorizontalScrollIndicator={false}
      onLayout={e => (widthRef.current = e.nativeEvent.layout.width)}
      onMomentumScrollEnd={handleMomentumEnd}
    >
      {Children.map(children, child => (
        <View style={[styles.page, { width: widthRef.current }]}>{child}</View>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  page: { flex: 1 },
});

export default PagerView;
