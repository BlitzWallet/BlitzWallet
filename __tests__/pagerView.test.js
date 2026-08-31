import { getPagerOffsets } from '../web-shims/pager-view';

describe('getPagerOffsets', () => {
  test('at page boundaries', () => {
    expect(getPagerOffsets(0, 400)).toEqual({ position: 0, offset: 0, page: 0 });
    expect(getPagerOffsets(400, 400)).toEqual({
      position: 1,
      offset: 0,
      page: 1,
    });
    expect(getPagerOffsets(800, 400)).toEqual({
      position: 2,
      offset: 0,
      page: 2,
    });
  });

  test('mid-page fractional offsets', () => {
    expect(getPagerOffsets(200, 400)).toEqual({
      position: 0,
      offset: 0.5,
      page: 1, // Math.round(0.5) is 1 in JS
    });
    expect(getPagerOffsets(600, 400)).toEqual({
      position: 1,
      offset: 0.5,
      page: 2,
    });
    const { position, offset } = getPagerOffsets(100, 400);
    expect(position).toBe(0);
    expect(offset).toBeCloseTo(0.25);
    expect(getPagerOffsets(100, 400).page).toBe(0);
  });

  test('uses clientWidth dynamically (not window width)', () => {
    // 100px container, 150px scroll -> raw 1.5
    expect(getPagerOffsets(150, 100)).toEqual({
      position: 1,
      offset: 0.5,
      page: 2,
    });
  });

  test('zero or invalid width returns page 0', () => {
    expect(getPagerOffsets(100, 0)).toEqual({
      position: 0,
      offset: 0,
      page: 0,
    });
    expect(getPagerOffsets(100, -10)).toEqual({
      position: 0,
      offset: 0,
      page: 0,
    });
  });

  test('clamps floating point drift at boundaries', () => {
    // Simulate 0.999999999 due to floating point
    const almostOne = 400 * 0.9999999999;
    const result = getPagerOffsets(almostOne, 400);
    expect(result.position).toBe(0);
    expect(result.offset).toBeCloseTo(1, 5);
    // offset is clamped to <=1
    expect(result.offset).toBeLessThanOrEqual(1);
  });
});
