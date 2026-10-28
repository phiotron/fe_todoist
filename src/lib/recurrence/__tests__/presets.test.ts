import {
  customToSpec,
  defaultCustom,
  isValidEvery,
  matchPreset,
  presetSpec,
  reanchor,
  specToCustom,
  type CustomRepeat,
} from '../presets';
import { fromRRule, toRRule } from '../rrule';

// 2026-10-28 is a Wednesday.
const DUE = '2026-10-28';

describe('presets', () => {
  it('build the rules the server stores for that due day', () => {
    expect(toRRule(presetSpec('daily', DUE))).toBe('FREQ=DAILY');
    expect(toRRule(presetSpec('weekly', DUE))).toBe('FREQ=WEEKLY;BYDAY=WE');
    expect(toRRule(presetSpec('weekdays', DUE))).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    expect(toRRule(presetSpec('monthly', '2026-10-31'))).toBe('FREQ=MONTHLY;BYMONTHDAY=31');
    expect(toRRule(presetSpec('yearly', '2028-02-29'))).toBe('FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29');
  });

  it('are recognised again, only for that due day and only based on the scheduled date', () => {
    for (const key of ['daily', 'weekly', 'weekdays', 'monthly', 'yearly'] as const) {
      expect(matchPreset(presetSpec(key, DUE), DUE)).toBe(key);
    }
    expect(matchPreset(presetSpec('weekly', DUE), '2026-10-29')).toBeNull(); // the due moved to a Thursday
    expect(matchPreset({ ...presetSpec('daily', DUE), fromCompletion: true }, DUE)).toBeNull();
    expect(matchPreset({ ...presetSpec('daily', DUE), untilDate: '2026-12-31' }, DUE)).toBeNull();
    expect(matchPreset(fromRRule('FREQ=MONTHLY;BYDAY=3FR'), DUE)).toBeNull();
  });
});

describe('customToSpec', () => {
  const custom = (patch: Partial<CustomRepeat>): CustomRepeat => ({ ...defaultCustom(), ...patch });

  it('Based on Scheduled anchors the rule on the due day', () => {
    expect(toRRule(customToSpec(custom({ every: 3 }), DUE))).toBe('FREQ=DAILY;INTERVAL=3');
    expect(toRRule(customToSpec(custom({ every: 2, unit: 'weeks' }), DUE))).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=WE');
    expect(toRRule(customToSpec(custom({ every: 2, unit: 'weekdays' }), DUE))).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU,WE,TH,FR');
    expect(toRRule(customToSpec(custom({ every: 3, unit: 'months' }), '2026-01-31'))).toBe('FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=31');
    expect(toRRule(customToSpec(custom({ unit: 'years' }), '2028-02-29'))).toBe('FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29');
  });

  it('Based on Completed carries no anchor and sets fromCompletion (every!)', () => {
    const weeks = customToSpec(custom({ basedOn: 'completed', every: 2, unit: 'weeks' }), DUE);
    expect(toRRule(weeks)).toBe('FREQ=WEEKLY;INTERVAL=2');
    expect(weeks.fromCompletion).toBe(true);
    expect(toRRule(customToSpec(custom({ basedOn: 'completed', unit: 'months' }), DUE))).toBe('FREQ=MONTHLY');
    expect(toRRule(customToSpec(custom({ basedOn: 'completed', unit: 'years' }), DUE))).toBe('FREQ=YEARLY');
    expect(toRRule(customToSpec(custom({ basedOn: 'completed', unit: 'weekdays' }), DUE))).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
  });

  it('Ends On date becomes UNTIL; never has none; there is no count', () => {
    expect(toRRule(customToSpec(custom({ endsOn: '2026-12-31' }), DUE))).toBe('FREQ=DAILY;UNTIL=20261231');
    expect(toRRule(customToSpec(custom({}), DUE))).not.toContain('UNTIL');
    expect(toRRule(customToSpec(custom({ endsOn: '2026-12-31' }), DUE))).not.toContain('COUNT');
  });

  it('only accepts an interval from 1 to 999', () => {
    expect([0, 1, 999, 1000, 1.5, Number.NaN].map(isValidEvery)).toEqual([false, true, true, false, false, false]);
  });
});

describe('reanchor', () => {
  it('moves a preset and a custom rule to the new due day', () => {
    expect(toRRule(reanchor(presetSpec('weekly', DUE), DUE, '2026-10-30'))).toBe('FREQ=WEEKLY;BYDAY=FR');
    expect(toRRule(reanchor(presetSpec('monthly', DUE), DUE, '2026-11-05'))).toBe('FREQ=MONTHLY;BYMONTHDAY=5');
    const custom = customToSpec({ basedOn: 'scheduled', every: 2, unit: 'weeks', endsOn: '2027-01-01' }, DUE);
    expect(toRRule(reanchor(custom, DUE, '2026-10-30'))).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=FR;UNTIL=20270101');
  });

  it('keeps the rule when the day does not change or the rule has no form', () => {
    const same = presetSpec('weekly', DUE);
    expect(reanchor(same, DUE, DUE)).toBe(same);
    const odd = fromRRule('FREQ=MONTHLY;BYDAY=3FR');
    expect(reanchor(odd, DUE, '2026-10-30')).toBe(odd);
  });
});

describe('specToCustom', () => {
  it('reads back what customToSpec wrote', () => {
    for (const basedOn of ['scheduled', 'completed'] as const) {
      for (const unit of ['days', 'weeks', 'weekdays', 'months', 'years'] as const) {
        const original: CustomRepeat = { basedOn, every: 4, unit, endsOn: '2027-03-01' };
        expect(specToCustom(customToSpec(original, DUE))).toEqual(original);
      }
    }
  });

  it('gives null for rules the form cannot show', () => {
    for (const rule of [
      'FREQ=MONTHLY;BYDAY=3FR',
      'FREQ=MONTHLY;BYMONTHDAY=-1',
      'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1',
      'FREQ=WEEKLY;BYDAY=MO,WE',
      'FREQ=YEARLY;BYMONTH=11;BYDAY=4TH',
      'FREQ=MONTHLY;BYMONTHDAY=1,15',
    ]) {
      expect(specToCustom(fromRRule(rule))).toBeNull();
    }
  });
});
