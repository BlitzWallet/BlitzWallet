import { useCallback, useEffect, useRef, useState } from 'react';

export default function useAdaptiveButtonLayout(labels = []) {
  const labelKey = labels.join('|');
  const count = labels.length;

  const [containerWidth, setContainerWidth] = useState(0);
  const [shouldStack, setShouldStack] = useState(false);

  // Each measurement is stamped with the containerWidth it was taken at.
  // A label's line count is only meaningful relative to the width it wrapped
  // against, so a measurement captured before the container was laid out
  // (width 0) or at a previous width must not drive the stacking decision.
  // index -> { width, wrapped }
  const [wrappedMap, setWrappedMap] = useState({});

  // Read synchronously inside the text-layout callback so each measurement is
  // stamped with the width that is live at the moment it fires.
  const containerWidthRef = useRef(0);

  // Reset the stack decision whenever the container resizes or the label text
  // changes, so the (now unforced) text can re-wrap and be re-evaluated.
  useEffect(() => {
    setShouldStack(false);
    setWrappedMap({});
  }, [containerWidth, labelKey]);

  // Decide once every label has a measurement taken at the CURRENT width.
  // Measurements stamped at a different width are treated as not-yet-measured,
  // which is what lets us ignore the stale pre-layout (width 0) measurement
  // even while it is still present in the same commit the reset was queued in.
  useEffect(() => {
    if (shouldStack) return;
    if (containerWidth === 0) return;
    for (let i = 0; i < count; i++) {
      const measurement = wrappedMap[i];
      if (!measurement || measurement.width !== containerWidth) return; // waiting
    }
    const anyWrapped = Object.values(wrappedMap).some(m => m.wrapped);
    if (anyWrapped) setShouldStack(true);
  }, [wrappedMap, shouldStack, containerWidth, count]);

  const handleContainerLayout = useCallback(e => {
    const next = Math.round(e?.nativeEvent?.layout?.width ?? 0);
    containerWidthRef.current = next;
    setContainerWidth(prev => (prev === next ? prev : next));
  }, []);

  const handleLabelLayout = useCallback((index, e) => {
    const lineCount = e?.nativeEvent?.lines?.length ?? 1;
    const wrapped = lineCount > 1;
    const width = containerWidthRef.current;
    setWrappedMap(prev => {
      const existing = prev[index];
      if (existing && existing.width === width && existing.wrapped === wrapped) {
        return prev;
      }
      return { ...prev, [index]: { width, wrapped } };
    });
  }, []);

  const getLabelProps = useCallback(
    index => ({
      CustomNumberOfLines: shouldStack ? 1 : null,
      onTextLayout: e => handleLabelLayout(index, e),
    }),
    [shouldStack, handleLabelLayout],
  );

  return {
    shouldStack,
    containerProps: { onLayout: handleContainerLayout },
    getLabelProps,
  };
}
