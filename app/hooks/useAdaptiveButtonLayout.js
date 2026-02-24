import { useCallback, useEffect, useState } from 'react';

export default function useAdaptiveButtonLayout(labels = []) {
  const labelKey = labels.join('|');

  const [containerWidth, setContainerWidth] = useState(0);
  const [shouldStack, setShouldStack] = useState(false);
  const [wrappedMap, setWrappedMap] = useState(() =>
    Object.fromEntries(labels.map((_, i) => [i, null])),
  );

  // Reset whenever the container resizes or the label text changes
  useEffect(() => {
    setShouldStack(false);
    setWrappedMap(Object.fromEntries(labels.map((_, i) => [i, null])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerWidth, labelKey]);

  // Once every button is measured, check if any wrapped → stack them
  useEffect(() => {
    if (shouldStack) return;
    const values = Object.values(wrappedMap);
    if (values.some(v => v === null)) return; // still waiting on measurements
    if (values.some(v => v === true)) setShouldStack(true);
  }, [wrappedMap, shouldStack]);

  const handleContainerLayout = useCallback(e => {
    const next = Math.round(e?.nativeEvent?.layout?.width ?? 0);
    setContainerWidth(prev => (prev === next ? prev : next));
  }, []);

  const handleLabelLayout = useCallback((index, e) => {
    const lineCount = e?.nativeEvent?.lines?.length ?? 1;
    const wrapped = lineCount > 1;
    setWrappedMap(prev =>
      prev[index] === wrapped ? prev : { ...prev, [index]: wrapped },
    );
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
