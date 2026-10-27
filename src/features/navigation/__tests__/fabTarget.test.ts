import { fabParamsFor, routeOfPath } from '../fabTarget';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('FAB target', () => {
  it('reads the tab route from the pathname (group segments are not part of it)', () => {
    expect(routeOfPath('/today')).toBe('today');
    expect(routeOfPath('/inbox')).toBe('inbox');
    expect(routeOfPath('/')).toBe('');
  });

  it('adds due today on Today, to the viewed day on Upcoming (never a past day), nowhere special on Inbox / Browse', () => {
    expect(fabParamsFor('/today', { today: '2026-10-23' })).toEqual({ dueDate: '2026-10-23' });
    expect(fabParamsFor('/upcoming', { today: '2026-10-23', upcomingDay: '2026-10-27' })).toEqual({ dueDate: '2026-10-27' });
    expect(fabParamsFor('/upcoming', { today: '2026-10-23', upcomingDay: '2026-10-20' })).toEqual({ dueDate: '2026-10-23' });
    expect(fabParamsFor('/inbox', { today: '2026-10-23' })).toEqual({});
    expect(fabParamsFor('/browse', { today: '2026-10-23' })).toEqual({});
  });
});
