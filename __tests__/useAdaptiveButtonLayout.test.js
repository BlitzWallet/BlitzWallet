import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import useAdaptiveButtonLayout from '../app/hooks/useAdaptiveButtonLayout';

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

// Renders a probe that exposes the hook's return value and mounts its hidden
// measureElement so the measuring <Text> nodes exist and can be driven manually
// (react-test-renderer does not run native layout).
function setup(initialLabels, options) {
  const state = { result: null, renders: 0 };
  let renderer;

  function Probe({ labels }) {
    state.renders += 1;
    const hook = useAdaptiveButtonLayout(labels, options);
    state.result = hook;
    return hook.measureElement;
  }

  act(() => {
    renderer = ReactTestRenderer.create(<Probe labels={initialLabels} />);
  });

  return {
    state,
    setLabels(labels) {
      act(() => renderer.update(<Probe labels={labels} />));
    },
    fireContainer(width) {
      act(() =>
        state.result.containerProps.onLayout({
          nativeEvent: { layout: { width } },
        }),
      );
    },
    fireLabel(index, width) {
      const texts = renderer.root.findAllByType(Text);
      act(() =>
        texts[index].props.onTextLayout({ nativeEvent: { lines: [{ width }] } }),
      );
    },
  };
}

describe('useAdaptiveButtonLayout', () => {
  it('stays in a row when the labels fit', () => {
    const h = setup(['Add', 'Pay']);
    h.fireContainer(400);
    h.fireLabel(0, 130);
    h.fireLabel(1, 140);
    expect(h.state.result.shouldStack).toBe(false);
  });

  it('stacks when the labels do not fit', () => {
    const h = setup(['Contribute', 'Share']);
    h.fireContainer(400);
    h.fireLabel(0, 180);
    h.fireLabel(1, 190);
    expect(h.state.result.shouldStack).toBe(true);
  });

  it('re-derives on resize: row -> stack when the container shrinks', () => {
    const h = setup(['Cancel', 'Save']);
    h.fireContainer(400);
    h.fireLabel(0, 130);
    h.fireLabel(1, 140);
    expect(h.state.result.shouldStack).toBe(false);
    h.fireContainer(300);
    expect(h.state.result.shouldStack).toBe(true);
  });

  it('re-derives on resize: stack -> row when the container grows (no latch)', () => {
    const h = setup(['Cancel', 'Save']);
    h.fireContainer(300);
    h.fireLabel(0, 130);
    h.fireLabel(1, 140);
    expect(h.state.result.shouldStack).toBe(true);
    h.fireContainer(400);
    expect(h.state.result.shouldStack).toBe(false);
  });

  it('does not decide before the container width is known', () => {
    const h = setup(['Directions', 'Pay']);
    h.fireLabel(0, 180);
    h.fireLabel(1, 190);
    // container still 0 -> no decision, stays at the initial false
    expect(h.state.result.shouldStack).toBe(false);
    h.fireContainer(400);
    expect(h.state.result.shouldStack).toBe(true);
  });

  it('waits until every label has been measured', () => {
    const h = setup(['Edit Profile', 'Show QR']);
    h.fireContainer(400);
    h.fireLabel(0, 190); // only one measured
    expect(h.state.result.shouldStack).toBe(false);
    h.fireLabel(1, 60);
    expect(h.state.result.shouldStack).toBe(true);
  });

  it('is order-independent: labels-before-container', () => {
    const h = setup(['Send', 'Receive']);
    h.fireLabel(0, 180);
    h.fireLabel(1, 190);
    h.fireContainer(400);
    expect(h.state.result.shouldStack).toBe(true);
  });

  it('is order-independent: container-before-labels (same result)', () => {
    const h = setup(['Send', 'Receive']);
    h.fireContainer(400);
    h.fireLabel(0, 180);
    h.fireLabel(1, 190);
    expect(h.state.result.shouldStack).toBe(true);
  });

  it('re-measures when the label text changes', () => {
    const h = setup(['Details', 'Support']);
    h.fireContainer(400);
    h.fireLabel(0, 60);
    h.fireLabel(1, 70);
    expect(h.state.result.shouldStack).toBe(false);

    // Longer labels for the same slots now do not fit -> stack.
    h.setLabels(['Technical Details', 'Contact Support Team']);
    h.fireLabel(0, 190);
    h.fireLabel(1, 190);
    expect(h.state.result.shouldStack).toBe(true);
  });

  it('re-measures on font-scale change without a latch', () => {
    const h = setup(['Back', 'Confirm']);
    h.fireContainer(400);
    h.fireLabel(0, 130);
    h.fireLabel(1, 140);
    expect(h.state.result.shouldStack).toBe(false);
    // Simulate a font scale increase: same labels re-report wider widths.
    h.fireLabel(0, 190);
    h.fireLabel(1, 190);
    expect(h.state.result.shouldStack).toBe(true);
  });

  it('does not re-render on duplicate or non-flipping events', () => {
    const h = setup(['Cancel', 'Save']);
    const base = h.state.renders;
    h.fireContainer(400); // false == initial false, no flip
    h.fireLabel(0, 130);
    h.fireLabel(1, 140); // still false, no flip
    expect(h.state.renders).toBe(base);
    h.fireContainer(400); // duplicate width, bails before reconcile
    expect(h.state.renders).toBe(base);
    h.fireContainer(300); // flips to true -> exactly one render
    expect(h.state.result.shouldStack).toBe(true);
    expect(h.state.renders).toBe(base + 1);
    h.fireContainer(300); // duplicate, no render
    expect(h.state.renders).toBe(base + 1);
  });

  it('plumbs custom geometry options through to the decision', () => {
    const h = setup(['Paste', 'Scan'], { gap: 12, buttonHorizontalPadding: 44 });
    h.fireContainer(400);
    h.fireLabel(0, 160);
    h.fireLabel(1, 60);
    // With padding 24 this would be a row; padding 44 forces a stack.
    expect(h.state.result.shouldStack).toBe(true);
  });
});
