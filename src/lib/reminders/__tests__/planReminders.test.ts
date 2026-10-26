import { MAX_SCHEDULED_REMINDERS, planReminders, type OccurrenceInput, type PlanSettings } from '..';

/** 10:00 on 23 Oct 2026 in Asia/Ho_Chi_Minh. */
const NOW = Date.parse('2026-10-23T03:00:00Z');
const HCM: PlanSettings = { enabled: true, timeZone: 'Asia/Ho_Chi_Minh' };

function occ(key: string, fireAt: string, extra: Partial<OccurrenceInput> = {}): OccurrenceInput {
  return { key, taskId: 't-1', kind: 'ABSOLUTE', fireAt, content: 'Họp nhóm', ...extra };
}

const iso = (ms: number) => new Date(ms).toISOString();

describe('planReminders — one occurrence', () => {
  it.each<[string, string, Partial<PlanSettings>, string | null]>([
    ['future fire time in Ho Chi Minh', '2026-10-23T12:00:00', {}, '2026-10-23T05:00:00.000Z'],
    ['fire time without seconds', '2026-10-23T12:00', {}, '2026-10-23T05:00:00.000Z'],
    ['one minute ahead', '2026-10-23T10:01:00', {}, '2026-10-23T03:01:00.000Z'],
    ['exactly now is skipped', '2026-10-23T10:00:00', {}, null],
    ['a passed time is dropped, never caught up', '2026-10-23T09:00:00', {}, null],
    ['New York account', '2026-10-23T09:00:00', { timeZone: 'America/New_York' }, '2026-10-23T13:00:00.000Z'],
    ['invalid zone falls back to Ho Chi Minh', '2026-10-24T09:00:00', { timeZone: 'Not/AZone' }, '2026-10-24T02:00:00.000Z'],
    ['malformed fire time', 'garbage', {}, null],
    ['impossible date', '2026-02-30T09:00:00', {}, null],
    ['a zoned instant is not a floating time', '2026-10-23T12:00:00Z', {}, null],
  ])('%s', (_name, fireAt, override, expected) => {
    const result = planReminders([occ('r-1', fireAt)], { ...HCM, ...override }, NOW);
    expect(result.map((reminder) => iso(reminder.fireAtMs))).toEqual(expected === null ? [] : [expected]);
  });
});

describe('planReminders — list rules', () => {
  it('returns nothing when reminders are turned off', () => {
    expect(planReminders([occ('r-1', '2026-10-24T09:00:00')], { ...HCM, enabled: false }, NOW)).toEqual([]);
  });

  it('keeps the 50 nearest, sorted by fire time', () => {
    const occurrences = Array.from({ length: 60 }, (_, i) => {
      const minute = String(59 - i).padStart(2, '0');
      return occ(`r-${String(i).padStart(2, '0')}`, `2026-10-24T00:${minute}:00`, { taskId: `t-${i}` });
    });

    const result = planReminders(occurrences, HCM, NOW);

    expect(MAX_SCHEDULED_REMINDERS).toBe(50);
    expect(result).toHaveLength(50);
    expect(result[0].id).toBe('r-59');
    expect(result[49].id).toBe('r-10');
    expect(result.every((reminder, i) => i === 0 || result[i - 1].fireAtMs <= reminder.fireAtMs)).toBe(true);
  });

  it('breaks ties on fire time by id', () => {
    const at = '2026-10-23T12:00:00';
    const result = planReminders([occ('r-b', at, { taskId: 't-b' }), occ('r-a', at, { taskId: 't-a' })], HCM, NOW);
    expect(result.map((reminder) => reminder.id)).toEqual(['r-a', 'r-b']);
  });

  it('keeps one entry per key', () => {
    expect(planReminders([occ('r-1', '2026-10-23T12:00:00'), occ('r-1', '2026-10-23T13:00:00')], HCM, NOW)).toHaveLength(1);
  });

  it('shows one notification for the same task at the same time, preferring a custom reminder', () => {
    const at = '2026-10-23T12:00:00';
    const auto = occ('auto:t-1', at, { kind: 'AUTO' });
    const custom = occ('r-1', at, { kind: 'RELATIVE' });
    expect(planReminders([auto, custom], HCM, NOW).map((reminder) => reminder.id)).toEqual(['r-1']);
    expect(planReminders([custom, auto], HCM, NOW).map((reminder) => reminder.id)).toEqual(['r-1']);
  });

  it('carries id, task, kind and title', () => {
    expect(
      planReminders([occ('auto:t-7', '2026-10-23T12:00:00', { taskId: 't-7', kind: 'AUTO', content: 'Nộp báo cáo' })], HCM, NOW),
    ).toEqual([
      { id: 'auto:t-7', taskId: 't-7', kind: 'AUTO', title: 'Nộp báo cáo', fireAtMs: Date.parse('2026-10-23T05:00:00Z') },
    ]);
  });

  it('moves a fire time inside a DST gap to the later instant', () => {
    const [planned] = planReminders(
      [occ('r-1', '2026-03-08T02:30:00')],
      { enabled: true, timeZone: 'America/New_York' },
      Date.parse('2026-03-01T00:00:00Z'),
    );
    expect(iso(planned.fireAtMs)).toBe('2026-03-08T07:30:00.000Z');
  });
});
