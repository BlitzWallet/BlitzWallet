import { useCallback, useRef, useState } from 'react';

// Width of the TopBar's right slot, mirrored onto the left slot so the title
// stays centred. Android snaps widths to its pixel grid by position, so this
// flips ~0.4px each pass (44.19 ↔ 43.81) and feeds back through the left
// minWidth forever. Ignore sub-pixel changes.
export default function useSideWidth(initial = 44) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);
  const onLayout = useCallback(e => {
    const w = e.nativeEvent.layout.width;
    setWidth(prev => (Math.abs(prev - w) < 1 ? prev : w));
  }, []);
  return [width, ref, onLayout];
}
