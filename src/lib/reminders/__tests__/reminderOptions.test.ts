import {
  AUTO_REMINDER_MINUTES,
  DEFAULT_AUTO_REMINDER_MINUTES,
  MAX_RELATIVE_OFFSET_MINUTES,
  RELATIVE_REMINDER_MINUTES,
  addDraft,
  applicableDrafts,
  describeOffset,
  draftId,
  formatFloatingForDisplay,
  formatWallClock,
  type ReminderDraft,
} from '..';

describe('describeOffset', () => {
  it.each<[number, ReturnType<typeof describeOffset>]>([
    [0, { unit: 'atTime', count: 0 }],
    [5, { unit: 'minutes', count: 5 }],
    [45, { unit: 'minutes', count: 45 }],
    [60, { unit: 'hours', count: 1 }],
    [90, { unit: 'minutes', count: 90 }],
    [120, { unit: 'hours', count: 2 }],
    [1440, { unit: 'days', count: 1 }],
    [2880, { unit: 'days', count: 2 }],
    [10080, { unit: 'days', count: 7 }],
  ])('%i minutes', (minutes, expected) => {
    expect(describeOffset(minutes)).toEqual(expected);
  });
});

describe('formatWallClock', () => {
  const morning = { year: 2026, month: 10, day: 4, hour: 9, minute: 5 };

  it.each<[string, Parameters<typeof formatWallClock>, string]>([
    ['DMY 24 h', [morning, 'DMY', 'H24'], '04/10/2026 09:05'],
    ['MDY 24 h', [morning, 'MDY', 'H24'], '10/04/2026 09:05'],
    ['DMY 12 h morning', [morning, 'DMY', 'H12'], '04/10/2026 9:05 AM'],
    ['12 h midnight', [{ ...morning, hour: 0, minute: 0 }, 'DMY', 'H12'], '04/10/2026 12:00 AM'],
    ['12 h noon', [{ ...morning, hour: 12, minute: 30 }, 'DMY', 'H12'], '04/10/2026 12:30 PM'],
    ['12 h evening', [{ ...morning, hour: 23, minute: 45 }, 'MDY', 'H12'], '10/04/2026 11:45 PM'],
  ])('%s', (_name, args, expected) => {
    expect(formatWallClock(...args)).toBe(expected);
  });

  it('formats a floating API value, null when malformed', () => {
    expect(formatFloatingForDisplay('2026-10-04T09:05:00', 'DMY', 'H24')).toBe('04/10/2026 09:05');
    expect(formatFloatingForDisplay('nope', 'DMY', 'H24')).toBeNull();
  });
});

describe('drafts', () => {
  const absolute: ReminderDraft = { type: 'ABSOLUTE', at: '2026-10-24T09:00' };
  const relative: ReminderDraft = { type: 'RELATIVE', minuteOffset: 30 };

  it('gives every draft a stable id', () => {
    expect(draftId(absolute)).toBe('ABSOLUTE:2026-10-24T09:00');
    expect(draftId(relative)).toBe('RELATIVE:30');
  });

  it('adds a draft once', () => {
    expect(addDraft(addDraft([absolute], relative), { ...relative })).toEqual([absolute, relative]);
  });

  it('drops relative drafts while the task has no time', () => {
    expect(applicableDrafts([absolute, relative], false)).toEqual([absolute]);
    expect(applicableDrafts([absolute, relative], true)).toEqual([absolute, relative]);
  });
});

describe('allowed values', () => {
  it('matches spec 12.1.1 and 5.9', () => {
    expect(AUTO_REMINDER_MINUTES).toEqual([0, 5, 10, 15, 30, 45, 60, 120, 180, 1440]);
    expect(DEFAULT_AUTO_REMINDER_MINUTES).toBe(30);
    expect(RELATIVE_REMINDER_MINUTES.every((minutes) => minutes >= 0 && minutes <= MAX_RELATIVE_OFFSET_MINUTES)).toBe(true);
  });
});
