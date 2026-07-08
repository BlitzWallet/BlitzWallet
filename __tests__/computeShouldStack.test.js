jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

import { computeShouldStack } from '../app/hooks/useAdaptiveButtonLayout';

// Defaults under test: gap 10, buttonHorizontalPadding 24, minWidth 120, epsilon 1.
// With containerWidth 400, count 2, gap 10 => perButtonOuter = 195.
describe('computeShouldStack', () => {
  it('stays in a row when both labels fit', () => {
    expect(
      computeShouldStack({
        containerWidth: 400,
        labelWidths: [130, 140],
        count: 2,
      }),
    ).toBe(false);
  });

  it('stacks when both labels are too wide', () => {
    expect(
      computeShouldStack({
        containerWidth: 400,
        labelWidths: [180, 190],
        count: 2,
      }),
    ).toBe(true);
  });

  it('stacks when only one label is too wide', () => {
    expect(
      computeShouldStack({
        containerWidth: 400,
        labelWidths: [60, 190],
        count: 2,
      }),
    ).toBe(true);
  });

  it('errs toward stacking at the exact boundary (epsilon)', () => {
    // perButtonOuter 195; label 171 => needed 195 > 194 => stack
    expect(
      computeShouldStack({
        containerWidth: 400,
        labelWidths: [171, 60],
        count: 2,
      }),
    ).toBe(true);
    // label 170 => needed 194, not > 194 => fits
    expect(
      computeShouldStack({
        containerWidth: 400,
        labelWidths: [170, 60],
        count: 2,
      }),
    ).toBe(false);
  });

  it('respects a custom gap (12 flips a boundary case that fits at 10)', () => {
    const args = { containerWidth: 300, labelWidths: [120, 60], count: 2 };
    // gap 10 => perButtonOuter 145; needed 144, not > 144 => row
    expect(computeShouldStack({ ...args, gap: 10 })).toBe(false);
    // gap 12 => perButtonOuter 144; needed 144 > 143 => stack
    expect(computeShouldStack({ ...args, gap: 12 })).toBe(true);
  });

  it('respects a custom buttonHorizontalPadding (icon buttons)', () => {
    const args = { containerWidth: 400, labelWidths: [160, 60], count: 2 };
    expect(
      computeShouldStack({ ...args, buttonHorizontalPadding: 24 }),
    ).toBe(false);
    expect(
      computeShouldStack({ ...args, buttonHorizontalPadding: 44 }),
    ).toBe(true);
  });

  it('stacks when the container is too narrow for the minWidth floor', () => {
    // perButtonOuter = 95 < 120 => stack regardless of label widths
    expect(
      computeShouldStack({
        containerWidth: 200,
        labelWidths: [10, 10],
        count: 2,
      }),
    ).toBe(true);
  });

  it('does not decide with a zero or negative container width', () => {
    expect(
      computeShouldStack({ containerWidth: 0, labelWidths: [10, 10], count: 2 }),
    ).toBe(false);
    expect(
      computeShouldStack({ containerWidth: -5, labelWidths: [10, 10], count: 2 }),
    ).toBe(false);
  });

  it('does not decide with no labels', () => {
    expect(
      computeShouldStack({ containerWidth: 400, labelWidths: [], count: 0 }),
    ).toBe(false);
  });

  it('handles a single label', () => {
    expect(
      computeShouldStack({ containerWidth: 200, labelWidths: [80], count: 1 }),
    ).toBe(false);
    expect(
      computeShouldStack({ containerWidth: 200, labelWidths: [190], count: 1 }),
    ).toBe(true);
  });

  it('is order-independent (symmetric over labelWidths)', () => {
    const a = computeShouldStack({
      containerWidth: 400,
      labelWidths: [60, 190],
      count: 2,
    });
    const b = computeShouldStack({
      containerWidth: 400,
      labelWidths: [190, 60],
      count: 2,
    });
    expect(a).toBe(b);
    expect(a).toBe(true);
  });
});
