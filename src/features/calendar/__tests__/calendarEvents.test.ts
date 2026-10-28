import type { CalendarEventResponse } from '../../../api/calendar';
import { clampWindowEnd, eventsOnDay } from '../calendarEvents';

function event(partial: Partial<CalendarEventResponse> & { id: string }): CalendarEventResponse {
  return {
    title: partial.id,
    allDay: false,
    startDate: '2026-11-02',
    endDate: '2026-11-02',
    startDatetime: '2026-11-02T09:00:00',
    endDatetime: '2026-11-02T10:00:00',
    location: null,
    ...partial,
  };
}

describe('eventsOnDay', () => {
  it('keeps the events that cover the day: all-day first, then by start time', () => {
    const list = [
      event({ id: 'late', startDatetime: '2026-11-02T15:00:00' }),
      event({ id: 'early', startDatetime: '2026-11-02T08:00:00' }),
      event({ id: 'allday', allDay: true, startDatetime: null, endDatetime: null }),
      event({ id: 'tomorrow', startDate: '2026-11-03', endDate: '2026-11-03' }),
    ];

    expect(eventsOnDay(list, '2026-11-02').map((e) => e.id)).toEqual(['allday', 'early', 'late']);
  });

  it('shows a multi-day event on every day it covers (last day inclusive)', () => {
    const trip = event({ id: 'trip', allDay: true, startDate: '2026-11-02', endDate: '2026-11-04' });

    expect(eventsOnDay([trip], '2026-11-02')).toHaveLength(1);
    expect(eventsOnDay([trip], '2026-11-04')).toHaveLength(1);
    expect(eventsOnDay([trip], '2026-11-05')).toHaveLength(0);
    expect(eventsOnDay([trip], '2026-11-01')).toHaveLength(0);
  });
});

describe('clampWindowEnd', () => {
  it('never lets the window pass the backend limit', () => {
    expect(clampWindowEnd('2026-11-02', '2026-11-10', 30)).toBe('2026-11-10');
    expect(clampWindowEnd('2026-11-02', '2027-03-01', 30)).toBe('2026-12-02');
    expect(clampWindowEnd('2026-11-02', '2026-12-02', 30)).toBe('2026-12-02');
  });
});
