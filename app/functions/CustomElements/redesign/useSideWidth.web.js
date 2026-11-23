import { useCallback, useLayoutEffect, useRef, useState } from 'react';

// Web: onLayout (ResizeObserver) fires after first paint, so the title visibly
// shifts. Measure synchronously before paint; onLayout keeps later changes.
export default function useSideWidth(initial = 44) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);
  const update = useCallback(w => {
    setWidth(prev => (Math.abs(prev - w) < 1 ? prev : w));
  }, []);
  useLayoutEffect(() => {
    const w = ref.current?.getBoundingClientRect?.().width;
    if (w) update(w);
  }, [update]);
  const onLayout = useCallback(
    e => update(e.nativeEvent.layout.width),
    [update],
  );
  return [width, ref, onLayout];
}
