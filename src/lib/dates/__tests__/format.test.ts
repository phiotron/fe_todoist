import { describeDeadline, describeDue } from '..';
import { formatDayHeader, formatDeadline, formatDueLabel, formatDuration, monthTitle, weekdayName, weekdayShort } from '../format';

const TZ = 'Asia/Ho_Chi_Minh';
const now = new Date('2026-10-23T03:00:00Z');
const label = (dueDate: string | null, dueDatetime: string | null = null, durationMinutes: number | null = null) => {
  const value = describeDue({ dueDate, dueDatetime, durationMinutes }, now, TZ);
  if (!value) throw new Error('expected a due label');
  return formatDueLabel(value);
};

describe('date formatting (vi)', () => {
  it('formats due labels the way the task rows show them', () => {
    expect(label(null, '2026-10-23T14:30:00')).toBe('Hôm nay 14:30');
    expect(label(null, '2026-10-23T14:30:00', 30)).toBe('Hôm nay 14:30–15:00');
    expect(label('2026-10-24')).toBe('Ngày mai');
    expect(label('2026-10-22')).toBe('Hôm qua');
    expect(label('2026-10-27')).toBe('Thứ Ba');
    expect(label('2026-11-15')).toBe('15/11');
    expect(label('2027-01-05')).toBe('05/01/2027');
  });

  it('formats Upcoming day headers, the week strip and the month title', () => {
    expect(formatDayHeader('2026-10-23', '2026-10-23')).toBe('23/10 · Hôm nay · Thứ Sáu');
    expect(formatDayHeader('2026-10-24', '2026-10-23')).toBe('24/10 · Ngày mai · Thứ Bảy');
    expect(formatDayHeader('2026-10-25', '2026-10-23')).toBe('25/10 · Chủ nhật');
    expect(weekdayName('2026-10-26')).toBe('Thứ Hai');
    expect(weekdayShort('2026-10-25')).toBe('CN');
    expect(weekdayShort('2026-10-26')).toBe('T2');
    expect(monthTitle('2026-10-23')).toBe('Tháng 10, 2026');
  });

  it('formats durations and deadlines', () => {
    expect(formatDuration(30)).toBe('30 phút');
    expect(formatDuration(60)).toBe('1 giờ');
    expect(formatDuration(90)).toBe('1 giờ 30 phút');
    const deadline = (key: string) => {
      const value = describeDeadline(key, now, TZ);
      if (!value) throw new Error('expected a deadline');
      return formatDeadline(value);
    };
    expect(deadline('2026-10-26')).toBe('Còn 3 ngày');
    expect(deadline('2026-10-23')).toBe('Hạn chót hôm nay');
    expect(deadline('2026-10-20')).toBe('Trễ hạn chót 3 ngày');
  });
});
