import { useCallback, useEffect, useRef } from 'react';

// Auto-scrolls a ScrollView so a freshly-expanded row's panel is brought into
// view. Mirrors the contact-list behavior in halfModalSendOptions.js, but the
// panel height is computed per-row via getPanelHeight since it varies.
export default function useExpandAutoScroll({
  expandedId,
  getPanelHeight, // (id) => number | null
  collapsedRowHeight = 45,
}) {
  const scrollViewRef = useRef(null);
  const rowLayoutsRef = useRef({}); // { [id]: y }
  const scrollOffsetRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const previousExpandedRef = useRef(null);

  const handleRowLayout = useCallback((id, y) => {
    rowLayoutsRef.current[id] = y;
  }, []);
  const onScroll = useCallback(e => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onLayout = useCallback(e => {
    scrollViewHeightRef.current = e.nativeEvent.layout.height;
  }, []);

  useEffect(() => {
    const prev = previousExpandedRef.current;
    previousExpandedRef.current = expandedId; // record for next change
    if (!expandedId || !scrollViewRef.current) return;

    const rowY = rowLayoutsRef.current[expandedId];
    if (rowY == null) return;
    const panelHeight = getPanelHeight(expandedId);
    if (panelHeight == null) return;

    // A previously-expanded row ABOVE this one collapses, shifting content up.
    let collapseShift = 0;
    if (prev && prev !== expandedId) {
      const prevY = rowLayoutsRef.current[prev];
      if (prevY != null && prevY < rowY) collapseShift = getPanelHeight(prev) || 0;
    }

    const adjustedRowY = rowY - collapseShift;
    const expandedBottomEdge = adjustedRowY + collapsedRowHeight + panelHeight;
    const visibleTop = scrollOffsetRef.current;
    const visibleBottom = scrollOffsetRef.current + scrollViewHeightRef.current;

    if (expandedBottomEdge > visibleBottom) {
      const y = expandedBottomEdge - scrollViewHeightRef.current + 16;
      setTimeout(() => scrollViewRef.current?.scrollTo({ y, animated: true }), 220);
    } else if (adjustedRowY < visibleTop + 50) {
      const y = Math.max(0, adjustedRowY - 35);
      setTimeout(() => scrollViewRef.current?.scrollTo({ y, animated: true }), 220);
    }
  }, [expandedId, getPanelHeight, collapsedRowHeight]);

  return { scrollViewRef, handleRowLayout, onScroll, onLayout };
}
