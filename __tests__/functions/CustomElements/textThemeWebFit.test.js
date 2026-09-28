import { findLargestFittingFontSize } from '../../../app/functions/CustomElements/textTheme.web';

// The auto-fit helper is pure; stub the theme hook so the test does not pull
// the native secure-store chain through context-store/theme.
jest.mock('../../../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false }),
}));

describe('findLargestFittingFontSize (textTheme.web auto-fit)', () => {
  test('returns max size when it already fits', () => {
    expect(findLargestFittingFontSize(8, 16, () => true)).toBe(16);
  });

  test('binary-searches the largest fitting size within tolerance', () => {
    // Simulates a label that fits at <= 10px inside its container.
    const best = findLargestFittingFontSize(5, 20, size => size <= 10);
    expect(best).toBeGreaterThanOrEqual(10 - 0.5);
    expect(best).toBeLessThanOrEqual(10);
  });

  test('never shrinks below the minimum (base * minimumFontScale)', () => {
    // Nothing fits except below min: must clamp to min, matching native
    // which stops at minimumFontScale instead of shrinking forever.
    expect(findLargestFittingFontSize(8, 16, size => size <= 2)).toBe(8);
  });

  test('settles in a bounded number of measurements', () => {
    let calls = 0;
    findLargestFittingFontSize(8, 16, size => {
      calls += 1;
      return size <= 12;
    });
    expect(calls).toBeLessThanOrEqual(14);
  });
});
