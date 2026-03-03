import { useEffect, useRef, useState } from 'react';

const STEP = 2;
const MIN_SIZE = 20;

export default function useAdaptiveFontSize(labels = [], startSize = 64) {
  const labelKey = labels.join('|');

  const [fontSize, setFontSize] = useState(startSize);
  const measuredLines = useRef(
    Object.fromEntries(labels.map((_, i) => [i, null])),
  );
  const settled = useRef(false);
  const currentFontSize = useRef(startSize);

  useEffect(() => {
    settled.current = false;
    currentFontSize.current = fontSize;
    measuredLines.current = Object.fromEntries(labels.map((_, i) => [i, null]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelKey, fontSize]);

  const checkAndStep = () => {
    if (settled.current) return;
    const values = Object.values(measuredLines.current);
    if (values.some(v => v === null)) {
      return;
    }
    const anyWrapped = values.some(v => v > 1);
    if (anyWrapped) {
      const next = Math.max(currentFontSize.current - STEP, MIN_SIZE);
      setFontSize(next);
    } else {
      settled.current = true;
    }
  };

  const getLabelProps = index => ({
    onTextLayout: e => {
      const lineCount = e?.nativeEvent?.lines?.length ?? 1;
      measuredLines.current[index] = lineCount;
      checkAndStep();
    },
  });

  return { fontSize, getLabelProps };
}
