// Web shim for react-native-pager-view: scroll-snap pager that mirrors the
// native PagerView event contract on web (onPageScroll + onPageSelected) and
// adds mouse click-drag so desktop users can swipe.
//
// ponytail: this shim now has full onPageScroll parity — BalanceDots and the
// home camera swipe both work on web. If you need scrollend-native settling
// (Safari 18.2+ has it), upgrade the debounce in handleScrollSettled.

import React, {
  Children,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Pure page-math — extracted so it can be unit-tested without DOM.
 * Given a scroll offset and container width, returns the native event
 * payload fields { position, offset, page } where `page` is the rounded
 * page index and (position+offset) is the fractional page progress.
 */
export function getPagerOffsets(scrollLeft, width) {
  if (!width || width <= 0) return { position: 0, offset: 0, page: 0 };
  const raw = scrollLeft / width;
  const position = Math.floor(raw);
  // clamp tiny floating-point drift at page boundaries
  const offset = Math.max(0, Math.min(1, raw - position));
  const page = Math.round(raw);
  return { position, offset, page };
}

const SETTLE_DEBOUNCE_MS = 100;
const DRAG_START_THRESHOLD_PX = 10;
const PAGE_SWIPE_THRESHOLD = 0.2;

export function getDragTargetPage(currentScrollLeft, startScrollLeft, width, pageCount) {
  if (!width || width <= 0) return 0;
  const startPage = Math.round(startScrollLeft / width);
  const delta = currentScrollLeft - startScrollLeft;
  let targetPage = startPage;
  if (delta > width * PAGE_SWIPE_THRESHOLD) targetPage = startPage + 1;
  else if (delta < -width * PAGE_SWIPE_THRESHOLD) targetPage = startPage - 1;
  if (typeof pageCount === 'number') {
    targetPage = Math.max(0, Math.min(pageCount - 1, targetPage));
  }
  return targetPage;
}

const PagerView = forwardRef(function PagerView(
  {
    children,
    initialPage = 0,
    onPageSelected,
    onPageScroll,
    style,
    scrollEnabled = true,
  },
  ref,
) {
  const containerRef = useRef(null);
  const currentPage = useRef(initialPage);
  const rafId = useRef(null);
  const settleTimer = useRef(null);
  const dragging = useRef(false);
  const isPointerDown = useRef(false);
  const dragState = useRef({ startX: 0, startLeft: 0 });
  // Keep latest callbacks in refs so DOM listeners stay stable.
  const onPageScrollRef = useRef(onPageScroll);
  const onPageSelectedRef = useRef(onPageSelected);
  const scrollEnabledRef = useRef(scrollEnabled);
  useEffect(() => {
    onPageScrollRef.current = onPageScroll;
  }, [onPageScroll]);
  useEffect(() => {
    onPageSelectedRef.current = onPageSelected;
  }, [onPageSelected]);
  useEffect(() => {
    scrollEnabledRef.current = scrollEnabled;
  }, [scrollEnabled]);

  const getWidth = () => containerRef.current?.clientWidth ?? 0;
  const getScrollLeft = () => containerRef.current?.scrollLeft ?? 0;

  const emitPageScroll = () => {
    const w = getWidth();
    if (!w) return;
    const { position, offset } = getPagerOffsets(getScrollLeft(), w);
    onPageScrollRef.current?.({ nativeEvent: { position, offset } });
  };

  const emitSettled = () => {
    const w = getWidth();
    if (!w) return;
    const { page } = getPagerOffsets(getScrollLeft(), w);
    if (page !== currentPage.current) currentPage.current = page;
    onPageSelectedRef.current?.({ nativeEvent: { position: page } });
  };

  const scheduleScrollEmit = () => {
    if (rafId.current != null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      emitPageScroll();
    });
  };

  const scheduleSettled = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      emitSettled();
    }, SETTLE_DEBOUNCE_MS);
  };

  const scrollToPage = (page, animated) => {
    const node = containerRef.current;
    if (!node) return;
    const w = node.clientWidth;
    if (!w) return;
    currentPage.current = page;
    // Clear any pending settle — the programmatic scroll will trigger its own.
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    node.scrollTo({ left: page * w, behavior: animated ? 'smooth' : 'auto' });
  };

  useImperativeHandle(ref, () => ({
    setPage: page => scrollToPage(page, true),
    setPageWithoutAnimation: page => scrollToPage(page, false),
  }));

  // initialPage on mount (auto, no animation)
  useEffect(() => {
    if (initialPage) {
      // Defer one frame so clientWidth is measured after layout.
      const id = requestAnimationFrame(() => scrollToPage(initialPage, false));
      return () => cancelAnimationFrame(id);
    }
  }, []);

  // Wire DOM scroll + pointer handlers directly so we own throttling and
  // can access clientWidth/scrollLeft without RNW indirection.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    // Ensure critical CSS lands even if RNW StyleSheet strips it.
    // ponytail: scrollend event exists in modern browsers (Safari 18.2+);
    // we keep the 100ms debounce as the cross-browser primary.
    node.style.scrollSnapType = scrollEnabled ? 'x mandatory' : 'none';
    node.style.scrollbarWidth = 'none';
    // touchAction pan-x lets vertical drags bubble to the outer ScrollView
    // (homeLightning sits inside a vertical Animated.ScrollView).
    node.style.touchAction = scrollEnabled ? 'pan-x' : 'none';
    if (!scrollEnabled) node.style.overflow = 'hidden';

    // Inject a one-time global rule to hide webkit scrollbars for pager containers
    if (
      typeof document !== 'undefined' &&
      !document.getElementById('pager-view-webkit-hide')
    ) {
      const styleTag = document.createElement('style');
      styleTag.id = 'pager-view-webkit-hide';
      styleTag.textContent =
        '.pager-view-container::-webkit-scrollbar{display:none}';
      document.head.appendChild(styleTag);
    }
    node.classList.add('pager-view-container');

    const handleScroll = () => {
      scheduleScrollEmit();
      scheduleSettled();
    };

    const handleScrollEnd = () => {
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
      emitSettled();
    };

    node.addEventListener('scroll', handleScroll, { passive: true });
    // scrollend is the correct native signal; keep debounce as fallback.
    node.addEventListener('scrollend', handleScrollEnd);

    // --- mouse click-drag (desktop) ---
    // Delay entering "dragging" state until movement exceeds
    // DRAG_START_THRESHOLD_PX so taps on children (e.g. UserSatAmount
    // Pressable in homeLightning) are not swallowed by setPointerCapture
    // and can toggle balance display. Once dragging starts we drive
    // scrollLeft directly and on release we snap with a 20% threshold
    // instead of the native 50% (Math.round) boundary.
    const onPointerDown = e => {
      if (!scrollEnabledRef.current) return;
      if (e.pointerType !== 'mouse') return;
      if (e.button !== 0) return;
      isPointerDown.current = true;
      dragging.current = false;
      dragState.current.startX = e.clientX;
      dragState.current.startLeft = node.scrollLeft;
    };

    const onPointerMove = e => {
      if (!isPointerDown.current) return;
      if (e.pointerType !== 'mouse') return;
      const dx = e.clientX - dragState.current.startX;
      if (!dragging.current) {
        if (Math.abs(dx) < DRAG_START_THRESHOLD_PX) return;
        dragging.current = true;
        try {
          node.setPointerCapture(e.pointerId);
        } catch {}
        node.style.scrollSnapType = 'none';
        node.style.cursor = 'grabbing';
        node.style.userSelect = 'none';
      }
      // Direct scrollLeft update — fires scroll events so onPageScroll stays live
      // and BalanceDots animate during the drag.
      node.scrollLeft =
        dragState.current.startLeft - dx;
    };

    const endDrag = e => {
      if (!isPointerDown.current) return;
      const wasDragging = dragging.current;
      isPointerDown.current = false;
      dragging.current = false;
      if (wasDragging) {
        node.style.scrollSnapType = scrollEnabledRef.current
          ? 'x mandatory'
          : 'none';
        node.style.cursor = scrollEnabledRef.current ? 'grab' : '';
        node.style.userSelect = '';
        try {
          if (e?.pointerId != null) node.releasePointerCapture(e.pointerId);
        } catch {}
        // Snap with 20% threshold: if the drag covered >20% of a page width,
        // advance to the next/prev page instead of requiring 50%.
        const w = node.clientWidth;
        if (!w) return;
        const pageCount = node.children.length || 0;
        const targetPage = getDragTargetPage(
          node.scrollLeft,
          dragState.current.startLeft,
          w,
          pageCount || undefined,
        );
        node.scrollTo({
          left: targetPage * w,
          behavior: 'smooth',
        });
      } else {
        // It was a tap/click without meaningful drag — let the child
        // Pressable handle it (e.g. balance toggle). Ensure no residual
        // styles and do not programatically scroll.
        try {
          if (e?.pointerId != null) node.releasePointerCapture(e.pointerId);
        } catch {}
      }
    };

    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', endDrag);
    node.addEventListener('pointercancel', endDrag);

    return () => {
      node.removeEventListener('scroll', handleScroll);
      node.removeEventListener('scrollend', handleScrollEnd);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', endDrag);
      node.removeEventListener('pointercancel', endDrag);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [scrollEnabled]);

  // Keep cursor affordance in sync when scrollEnabled toggles without remount.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    node.style.cursor = scrollEnabled && !dragging.current ? 'grab' : '';
  }, [scrollEnabled]);

  const pages = Children.map(children, child => (
    <View style={styles.page}>{child}</View>
  ));

  return (
    <View
      ref={containerRef}
      style={[styles.container, style, !scrollEnabled && styles.disabled]}
    >
      {pages}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    overflowX: 'scroll',
    overflowY: 'hidden',
    scrollSnapType: 'x mandatory',
    scrollbarWidth: 'none',
    touchAction: 'pan-x',
    cursor: 'grab',
  },
  disabled: {
    overflowX: 'hidden',
    overflowY: 'hidden',
    touchAction: 'none',
    cursor: 'default',
  },
  page: {
    width: '100%',
    flexShrink: 0,
    scrollSnapAlign: 'start',
  },
});

export default PagerView;
