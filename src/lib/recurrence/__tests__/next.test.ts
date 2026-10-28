import vectors from '../__fixtures__/recurrence-vectors.json';
import { nextDue } from '../next';
import { fromRRule } from '../rrule';

interface Vector {
  name: string;
  rule: string;
  fromCompletion: boolean;
  due: string;
  completedOn: string;
  timezone: string;
  expectedNext: string | null;
}

/** Shared with the backend (RecurrenceServiceTest reads the same file, contract 8.3): a difference is a bug. */
describe('nextDue — shared vectors', () => {
  it.each((vectors as Vector[]).map((vector) => [vector.name, vector] as const))('%s', (_name, vector) => {
    const spec = { ...fromRRule(vector.rule), fromCompletion: vector.fromCompletion };
    expect(nextDue(spec, vector.due, new Date(vector.completedOn), vector.timezone)).toBe(vector.expectedNext);
  });

  it('covers the mandatory cases of contract 8.3', () => {
    const names = (vectors as Vector[]).map((vector) => vector.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'month end 31 -> 30',
        'month 30 -> back to 31',
        'month end 31 -> 28 Feb',
        '29 Feb yearly -> 28 Feb',
        'every other week',
        'every 3rd friday',
        'every last workday',
        'every! 3 days counts from the completion day',
        'overdue weekly jumps to the first occurrence after today',
        'until includes the last day',
        'until reached ends the cycle',
        'just after midnight in the account zone is already tomorrow',
      ]),
    );
  });
});

describe('nextDue — extra cases (same as RecurrenceServiceTest)', () => {
  const at = new Date('2026-10-27T03:00:00Z');

  it('clamps BYMONTHDAY=30 to the last day of February', () => {
    const spec = { ...fromRRule('FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30;UNTIL=20271231'), fromCompletion: false };
    expect(nextDue(spec, '2026-10-27', at, 'UTC')).toBe('2027-02-28');
  });

  it('every! ignores a due in the future', () => {
    const spec = { ...fromRRule('FREQ=DAILY;INTERVAL=2'), fromCompletion: true };
    expect(nextDue(spec, '2026-11-20', at, 'UTC')).toBe('2026-10-29');
  });

  it('ends the cycle when the first candidate is past UNTIL', () => {
    const spec = { ...fromRRule('FREQ=MONTHLY;BYMONTHDAY=15;UNTIL=20261110'), fromCompletion: false };
    expect(nextDue(spec, '2026-10-15', new Date('2026-10-15T03:00:00Z'), 'UTC')).toBeNull();
  });

  it('accepts a time without seconds and answers with seconds', () => {
    const spec = { ...fromRRule('FREQ=DAILY'), fromCompletion: false };
    expect(nextDue(spec, '2026-10-27T09:05', at, 'UTC')).toBe('2026-10-28T09:05:00');
  });
});
