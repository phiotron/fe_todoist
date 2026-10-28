import { KARMA_LEVELS, barRatios, progressRatio, remaining, trendRatios, withCurrent } from '../productivityModel';

describe('productivityModel', () => {
  it('lists the current goal even when it is not a preset, in order', () => {
    expect(withCurrent([1, 5, 10], 5)).toEqual([1, 5, 10]);
    expect(withCurrent([1, 5, 10], 7)).toEqual([1, 5, 7, 10]);
    expect(withCurrent([1, 5, 10], 200)).toEqual([1, 5, 10, 200]);
  });

  it('progress is clamped to 0..1 and remaining never goes below 0', () => {
    expect(progressRatio(2, 5)).toBe(0.4);
    expect(progressRatio(9, 5)).toBe(1);
    expect(progressRatio(1, 0)).toBe(0);
    expect(remaining(2, 5)).toBe(3);
    expect(remaining(7, 5)).toBe(0);
  });

  it('bars: the goal is the full height unless a value is taller', () => {
    expect(barRatios([0, 2, 5], 5)).toEqual([0, 0.4, 1]);
    expect(barRatios([0, 10], 5)).toEqual([0, 1]);
    expect(barRatios([0, 0], 5)).toEqual([0, 0]);
    expect(barRatios([])).toEqual([]);
  });

  it('trend: lowest karma is a short bar, highest a full bar, a flat window is half height', () => {
    const ratios = trendRatios([
      { date: 'd1', karma: 10 },
      { date: 'd2', karma: 20 },
      { date: 'd3', karma: 30 },
    ]);
    expect(ratios[0]).toBeCloseTo(0.1);
    expect(ratios[1]).toBeCloseTo(0.55);
    expect(ratios[2]).toBeCloseTo(1);
    expect(trendRatios([{ date: 'd1', karma: 4 }, { date: 'd2', karma: 4 }])).toEqual([0.5, 0.5]);
    expect(trendRatios([])).toEqual([]);
  });

  it('has the 8 Karma levels from Beginner 0 to Enlightened 50 000', () => {
    expect(KARMA_LEVELS).toHaveLength(8);
    expect(KARMA_LEVELS[0]).toEqual({ level: 'BEGINNER', minKarma: 0 });
    expect(KARMA_LEVELS[1].minKarma - 223).toBe(277);
    expect(KARMA_LEVELS[7]).toEqual({ level: 'ENLIGHTENED', minKarma: 50000 });
  });
});
