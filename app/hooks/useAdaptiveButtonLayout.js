import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import ThemeText from '../functions/CustomElements/textTheme';

// Pure decision: given the container width and each label's intrinsic single-line
// width, decide whether the buttons must stack (column) instead of sitting in a row.
// Kept pure and side-effect free so it can be unit tested in isolation.
export function computeShouldStack({
  containerWidth,
  labelWidths,
  count,
  gap = 10,
  buttonHorizontalPadding = 24,
  minWidth = 120,
  epsilon = 1,
}) {
  if (!containerWidth || containerWidth <= 0) return false; // undecidable yet
  if (!count || labelWidths.length < count) return false; // still measuring
  const perButtonOuter = (containerWidth - gap * (count - 1)) / count;
  // RN enforces the button minWidth, so it will overflow the row before shrinking
  // below it — treat that as a stack trigger regardless of the text widths.
  if (perButtonOuter < minWidth) return true;
  return labelWidths.some(
    w => w + buttonHorizontalPadding > perButtonOuter - epsilon,
  );
}

// Decides row vs column layout for a set of side-by-side buttons by measuring each
// label's intrinsic single-line width in a hidden, width-unconstrained layer (the
// returned `measureElement`) and comparing it against the measured container width.
//
// Measurement is fully decoupled from the visible layout: the hidden labels always
// render single-line at their natural width, so the measurement never depends on the
// current decision. That removes the row->stack->row oscillation and the one-way
// latch of the old line-counting approach. The decision (`shouldStack`) is a pure
// function of the measurements, recomputed whenever either input changes, and only
// commits to React state when the boolean actually flips.
export default function useAdaptiveButtonLayout(labels = [], options = {}) {
  const {
    gap = 10,
    buttonHorizontalPadding = 24,
    minWidth = 120,
    textStyle = null,
    epsilon = 1,
  } = options;

  const labelKey = labels.join(' ');
  const count = labels.length;

  const [shouldStack, setShouldStack] = useState(false);

  // Measurements live in refs so layout callbacks never trigger a re-render; only a
  // genuine `shouldStack` flip does.
  const labelWidthsRef = useRef({});
  const containerWidthRef = useRef(0);
  // Which label set the stored widths belong to — guards against stale onTextLayout
  // callbacks fired for a previous set of labels.
  const measuredKeyRef = useRef(labelKey);

  const reconcile = useCallback(() => {
    if (measuredKeyRef.current !== labelKey) return;
    if (containerWidthRef.current <= 0) return;
    const widths = [];
    for (let i = 0; i < count; i++) {
      const w = labelWidthsRef.current[i];
      if (w == null) return; // still waiting on a measurement
      widths.push(w);
    }
    const next = computeShouldStack({
      containerWidth: containerWidthRef.current,
      labelWidths: widths,
      count,
      gap,
      buttonHorizontalPadding,
      minWidth,
      epsilon,
    });
    setShouldStack(prev => (prev === next ? prev : next));
  }, [labelKey, count, gap, buttonHorizontalPadding, minWidth, epsilon]);

  const onContainerLayout = useCallback(
    e => {
      const next = Math.round(e?.nativeEvent?.layout?.width ?? 0);
      if (next === containerWidthRef.current) return;
      containerWidthRef.current = next;
      reconcile();
    },
    [reconcile],
  );

  const onLabelMeasure = useCallback(
    (index, e) => {
      const next = e?.nativeEvent?.lines?.[0]?.width ?? 0;
      if (labelWidthsRef.current[index] === next) return;
      labelWidthsRef.current[index] = next;
      reconcile();
    },
    [reconcile],
  );

  // When the label set changes, invalidate the stored widths and re-key. We do NOT
  // reset `shouldStack`: the hidden measurer re-fires onTextLayout for the new labels
  // and reconcile() flips the decision only if needed, avoiding a visible flash.
  useEffect(() => {
    labelWidthsRef.current = {};
    measuredKeyRef.current = labelKey;
    reconcile();
  }, [labelKey, reconcile]);

  const measureElement = useMemo(
    () => (
      <View
        pointerEvents="none"
        style={{ position: 'absolute', opacity: 0, left: 0, top: 0 }}
      >
        {labels.map((label, i) => (
          <ThemeText
            key={`${i}-${label}`}
            content={label}
            CustomNumberOfLines={1}
            styles={[{ alignSelf: 'flex-start' }, textStyle]}
            onTextLayout={e => onLabelMeasure(i, e)}
          />
        ))}
      </View>
    ),
    // labelKey captures label content; textStyle affects measured width.
    [labelKey, textStyle, onLabelMeasure],
  );

  return {
    shouldStack,
    containerProps: { onLayout: onContainerLayout },
    measureElement,
  };
}
