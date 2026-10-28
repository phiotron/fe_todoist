import { groupByDay } from '../activityModel';
import { activityItem } from '../../../test/m10Fixtures';

describe('groupByDay', () => {
  it('groups newest-first events by the day in the ACCOUNT time zone', () => {
    // 18:30 UTC on 11 Nov = 01:30 on 12 Nov in Ho Chi Minh City, but still the 11th in UTC.
    const items = [
      activityItem({ id: 'a', createdAt: '2026-11-11T18:30:00Z' }),
      activityItem({ id: 'b', createdAt: '2026-11-11T16:30:00Z' }),
      activityItem({ id: 'c', createdAt: '2026-11-11T02:00:00Z' }),
    ];
    expect(groupByDay(items, 'Asia/Ho_Chi_Minh').map((g) => [g.day, g.items.map((i) => i.id)])).toEqual([
      ['2026-11-12', ['a']],
      ['2026-11-11', ['b', 'c']],
    ]);
    expect(groupByDay(items, 'UTC').map((g) => [g.day, g.items.length])).toEqual([['2026-11-11', 3]]);
  });

  it('is empty for no events', () => {
    expect(groupByDay([], 'UTC')).toEqual([]);
  });
});
