import '../../../i18n';
import i18n from '../../../i18n';
import { formatDayHeader } from '../../../lib/dates/format';
import { makeTask } from '../../../test/m1Fixtures';
import { groupLabel, layoutLabel } from '../displayLabels';
import { addedDayOf, groupTasks, type GroupContext } from '../groupTasks';

const ctx: GroupContext = { todayKey: '2026-11-04', labels: new Map(), timeZone: 'Asia/Ho_Chi_Minh' };

describe('M7 Grouping "Added date"', () => {
  it('reads the creation day in the account time zone, not UTC', () => {
    expect(addedDayOf({ createdAt: '2026-11-03T17:30:00Z' }, 'Asia/Ho_Chi_Minh')).toBe('2026-11-04');
    expect(addedDayOf({ createdAt: '2026-11-03T17:30:00Z' }, 'UTC')).toBe('2026-11-03');
    expect(addedDayOf({ createdAt: '2026-11-03T17:30:00Z' })).toBe('2026-11-03');
    expect(addedDayOf({})).toBeNull();
  });

  it('groups neighbours created on the same account-zone day (server sorts newest day first)', () => {
    const tasks = [
      makeTask({ id: 'a', createdAt: '2026-11-04T02:00:00Z' }),
      makeTask({ id: 'b', createdAt: '2026-11-03T17:30:00Z' }),
      makeTask({ id: 'c', createdAt: '2026-11-01T05:00:00Z' }),
    ];
    const groups = groupTasks(tasks, 'ADDED', ctx);
    expect(groups.map((group) => [group.key, group.tasks.map((task) => task.id)])).toEqual([
      ['added:2026-11-04', ['a', 'b']],
      ['added:2026-11-01', ['c']],
    ]);
    expect(groups[0].title).toBe(i18n.t('display.groups.added', { date: formatDayHeader('2026-11-04', '2026-11-04') }));
    expect(groups[0].title).toContain(i18n.t('dates.today'));
  });

  it('has a label for the grouping and for every layout, in both languages', async () => {
    expect(groupLabel('ADDED', false)).toBe('Ngày thêm');
    expect(layoutLabel('LIST')).toBe('Danh sách');
    expect(layoutLabel('BOARD')).toBe('Bảng');
    expect(layoutLabel('CALENDAR')).toBe('Lịch');
    await i18n.changeLanguage('en');
    try {
      expect(groupLabel('ADDED', true)).toBe('Date added');
      expect(layoutLabel('CALENDAR')).toBe('Calendar');
    } finally {
      await i18n.changeLanguage('vi');
    }
  });
});
