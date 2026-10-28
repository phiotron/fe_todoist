import { newlyReached, goalStateOf, type GoalState } from '../celebration';
import { productivity } from '../../../test/m10Fixtures';

const base: GoalState = { today: '2026-11-12', weekStart: '2026-11-09', dailyReached: false, weeklyReached: false };

describe('newlyReached', () => {
  it('never celebrates the first answer of a session', () => {
    expect(newlyReached(null, { ...base, dailyReached: true, weeklyReached: true })).toEqual({ daily: false, weekly: false });
  });

  it('celebrates a goal that flips to reached on the same day / week', () => {
    expect(newlyReached(base, { ...base, dailyReached: true })).toEqual({ daily: true, weekly: false });
    expect(newlyReached(base, { ...base, weeklyReached: true })).toEqual({ daily: false, weekly: true });
    expect(newlyReached(base, { ...base, dailyReached: true, weeklyReached: true })).toEqual({ daily: true, weekly: true });
  });

  it('does not celebrate again while it stays reached, or when it was reached before', () => {
    const reached = { ...base, dailyReached: true };
    expect(newlyReached(reached, reached)).toEqual({ daily: false, weekly: false });
  });

  it('does not celebrate a new day / week that starts already reached (a lowered goal)', () => {
    expect(newlyReached(base, { ...base, today: '2026-11-13', dailyReached: true })).toEqual({ daily: false, weekly: false });
    expect(newlyReached(base, { ...base, weekStart: '2026-11-16', weeklyReached: true })).toEqual({ daily: false, weekly: false });
  });

  it('reads the state from a productivity answer', () => {
    const data = productivity();
    data.daily.reached = true;
    expect(goalStateOf(data)).toEqual({ today: '2026-11-12', weekStart: '2026-11-09', dailyReached: true, weeklyReached: false });
  });
});
