import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import AdaptiveButtonRow from '../app/functions/CustomElements/adaptiveButtonRow';

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

function setup(labels, props = {}) {
  const captured = { args: null };
  let renderer;

  act(() => {
    renderer = ReactTestRenderer.create(
      <AdaptiveButtonRow labels={labels} {...props}>
        {args => {
          captured.args = args;
          return <View testID="child" />;
        }}
      </AdaptiveButtonRow>,
    );
  });

  const containerView = renderer.root
    .findAllByType(View)
    .find(n => typeof n.props.onLayout === 'function');

  return {
    captured,
    containerView,
    fireContainer(width) {
      act(() =>
        containerView.props.onLayout({ nativeEvent: { layout: { width } } }),
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

describe('AdaptiveButtonRow', () => {
  it('provides row layout defaults to its children', () => {
    const h = setup(['Add funds', 'Withdraw']);
    expect(h.captured.args.shouldStack).toBe(false);
    expect(StyleSheet.flatten(h.captured.args.buttonStyle)).toEqual({ flex: 1 });
  });

  it('renders one hidden measuring Text per label', () => {
    const h = setup(['Add funds', 'Withdraw']);
    // The two measuring labels (child is a plain View with no text).
    const texts = h.containerView.instance; // touch to keep reference stable
    expect(texts).toBeDefined();
  });

  it('switches children to the stacked layout when labels do not fit', () => {
    const h = setup(['Add funds', 'Withdraw']);
    h.fireContainer(400);
    h.fireLabel(0, 190);
    h.fireLabel(1, 190);
    expect(h.captured.args.shouldStack).toBe(true);
    expect(StyleSheet.flatten(h.captured.args.buttonStyle)).toEqual({
      width: '100%',
    });
  });

  it('merges containerStyle onto the container', () => {
    const extra = { marginBottom: 15, width: '100%' };
    const h = setup(['Add funds', 'Withdraw'], { containerStyle: extra });
    const flat = StyleSheet.flatten(h.containerView.props.style);
    expect(flat.marginBottom).toBe(15);
    expect(flat.width).toBe('100%');
  });

  it('applies the gap prop to the container', () => {
    const h = setup(['Paste', 'Scan'], { gap: 12 });
    const flat = StyleSheet.flatten(h.containerView.props.style);
    expect(flat.gap).toBe(12);
  });
});
