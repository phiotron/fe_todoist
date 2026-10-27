import { act, renderHook } from '@testing-library/react-native';
import {
  DEFAULT_DISPLAY_PREFS,
  formatDate,
  formatTime,
  getDisplayPrefs,
  setDisplayPrefs,
  useDisplayPrefs,
} from '../displayFormat';

afterEach(() => setDisplayPrefs(DEFAULT_DISPLAY_PREFS));

describe('formatDate', () => {
  it('DMY or MDY, with or without the year', () => {
    expect(formatDate('2026-03-05', true, 'DMY')).toBe('05/03/2026');
    expect(formatDate('2026-03-05', false, 'DMY')).toBe('05/03');
    expect(formatDate('2026-03-05', true, 'MDY')).toBe('03/05/2026');
    expect(formatDate('2026-03-05', false, 'MDY')).toBe('03/05');
  });

  it('uses the current display preference by default', () => {
    expect(formatDate('2026-03-05', false)).toBe('05/03');
    setDisplayPrefs({ dateFormat: 'MDY', timeFormat: 'H24' });
    expect(formatDate('2026-03-05', false)).toBe('03/05');
  });
});

describe('formatTime', () => {
  it.each([
    ['14:30', 'H24', '14:30'],
    ['09:07:00', 'H24', '09:07'],
    ['14:30', 'H12', '2:30 PM'],
    ['00:05', 'H12', '12:05 AM'],
    ['12:00', 'H12', '12:00 PM'],
    ['11:59', 'H12', '11:59 AM'],
  ] as const)('formatTime(%s, %s) → %s', (time, format, expected) => {
    expect(formatTime(time, format)).toBe(expected);
  });

  it('uses the current display preference by default', () => {
    expect(formatTime('14:30')).toBe('14:30');
    setDisplayPrefs({ dateFormat: 'DMY', timeFormat: 'H12' });
    expect(formatTime('14:30')).toBe('2:30 PM');
  });
});

describe('display preference store', () => {
  it('starts with the spec defaults and ignores a change to the same values', () => {
    expect(getDisplayPrefs()).toEqual({ dateFormat: 'DMY', timeFormat: 'H24' });
    const before = getDisplayPrefs();
    setDisplayPrefs({ dateFormat: 'DMY', timeFormat: 'H24' });
    expect(getDisplayPrefs()).toBe(before);
  });

  it('useDisplayPrefs re-renders its component when the preference changes', async () => {
    const { result } = await renderHook(() => useDisplayPrefs());
    expect(result.current.timeFormat).toBe('H24');

    await act(async () => {
      setDisplayPrefs({ dateFormat: 'MDY', timeFormat: 'H12' });
    });

    expect(result.current).toEqual({ dateFormat: 'MDY', timeFormat: 'H12' });
  });
});
