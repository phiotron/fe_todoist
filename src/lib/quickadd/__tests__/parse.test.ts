import { parseQuickAdd, type ParseContext } from '..';

/** "Today" is fixed: Tuesday 2026-10-27 (the day of the Todoist survey, khảo sát mục 3). */
const base: ParseContext = {
  today: '2026-10-27',
  dateSettings: { startDay: 1, nextWeek: 1, weekendStartDay: 6 },
  dateFormat: 'DMY',
  smartDate: true,
  projects: ['Work', 'Personal Errands', 'Inbox'],
  sections: ['Meetings', 'Long term'],
};

const parse = (text: string, ctx: Partial<ParseContext> = {}) => parseQuickAdd(text, { ...base, ...ctx });

describe('parseQuickAdd — spec 13 sample', () => {
  it('"Meeting tomorrow 9-10 #Work p1 %urgent {friday}" gives every field', () => {
    const result = parse('Meeting tomorrow 9-10 #Work p1 %urgent {friday}');
    expect(result.content).toBe('Meeting');
    expect(result.due).toEqual({ date: '2026-10-28', time: '09:00', durationMinutes: 60 });
    expect(result.projectName).toBe('Work');
    expect(result.priority).toBe(1);
    expect(result.labels).toEqual(['urgent']);
    expect(result.deadline).toBe('2026-10-30');
    expect(result.tokens.map((token) => [token.kind, token.text])).toEqual([
      ['date', 'tomorrow 9-10'],
      ['project', '#Work'],
      ['priority', 'p1'],
      ['label', '%urgent'],
      ['deadline', '{friday}'],
    ]);
  });

  it('reports token positions in the original text', () => {
    const [token] = parse('Call mom tomorrow').tokens;
    expect(token).toMatchObject({ kind: 'date', start: 9, end: 17, text: 'tomorrow', key: 'date:tomorrow' });
  });
});

describe('parseQuickAdd — dates', () => {
  it.each([
    ['today', '2026-10-27'],
    ['tod', '2026-10-27'],
    ['tomorrow', '2026-10-28'],
    ['tmr', '2026-10-28'],
    ['yesterday', '2026-10-26'],
    ['friday', '2026-10-30'],
    ['on fri', '2026-10-30'],
    // was bare 'tue': 3-letter weekday abbreviations now need an English context (VIQA, see the block at the end)
    ['this tue', '2026-11-03'], // today is Tuesday → the next one
    ['next friday', '2026-11-06'], // Friday of NEXT week (Todoist)
    ['next monday', '2026-11-02'],
    ['next week', '2026-11-02'],
    ['this weekend', '2026-10-31'],
    ['weekend', '2026-10-31'],
    ['in 3 days', '2026-10-30'],
    ['in 2 weeks', '2026-11-10'],
    ['in 1 month', '2026-11-27'],
    ['Oct 30', '2026-10-30'],
    ['30 Oct', '2026-10-30'],
    ['October 30th 2027', '2027-10-30'],
    ['nov 5', '2026-11-05'],
    ['Jan 5', '2027-01-05'], // already past this year → next year
    ['30/10', '2026-10-30'],
    ['2026-12-01', '2026-12-01'],
  ])('%s → %s', (text, date) => {
    const result = parse(`Pay ${text}`);
    expect(result.due).toEqual({ date, time: null, durationMinutes: null });
    expect(result.content).toBe('Pay');
  });

  it('reads 10/30 as month/day when the account uses MDY', () => {
    expect(parse('Pay 10/30', { dateFormat: 'MDY' }).due?.date).toBe('2026-10-30');
  });

  it.each(['Feb 30', '31/11', 'monkey', 'sundays', 'nextfriday'])('does not recognise "%s"', (text) => {
    const result = parse(`Pay ${text}`);
    expect(result.due).toBeUndefined();
    expect(result.content).toBe(`Pay ${text}`);
  });

  it('only recognises the first date group', () => {
    const result = parse('Call tomorrow or friday');
    expect(result.due?.date).toBe('2026-10-28');
    expect(result.content).toBe('Call or friday');
  });
});

describe('parseQuickAdd — times and durations', () => {
  it.each([
    ['tomorrow 5pm', { date: '2026-10-28', time: '17:00', durationMinutes: null }],
    ['tomorrow at 5:30 pm', { date: '2026-10-28', time: '17:30', durationMinutes: null }],
    ['friday 17:00', { date: '2026-10-30', time: '17:00', durationMinutes: null }],
    ['next friday at 3pm', { date: '2026-11-06', time: '15:00', durationMinutes: null }],
    ['at 9', { date: '2026-10-27', time: '09:00', durationMinutes: null }],
    ['5pm', { date: '2026-10-27', time: '17:00', durationMinutes: null }],
    ['12am', { date: '2026-10-27', time: '00:00', durationMinutes: null }],
    ['noon', { date: '2026-10-27', time: '12:00', durationMinutes: null }],
    ['tomorrow 9-10', { date: '2026-10-28', time: '09:00', durationMinutes: 60 }],
    ['2pm-4pm', { date: '2026-10-27', time: '14:00', durationMinutes: 120 }],
    ['9:30-11', { date: '2026-10-27', time: '09:30', durationMinutes: 90 }],
    ['9-10am', { date: '2026-10-27', time: '09:00', durationMinutes: 60 }],
    ['11-1pm', { date: '2026-10-27', time: '11:00', durationMinutes: 120 }],
    ['tomorrow 9am for 45 min', { date: '2026-10-28', time: '09:00', durationMinutes: 45 }],
    ['tomorrow 9am for 2h', { date: '2026-10-28', time: '09:00', durationMinutes: 120 }],
  ])('%s', (text, due) => {
    const result = parse(`Gym ${text}`);
    expect(result.due).toEqual(due);
    expect(result.content).toBe('Gym');
  });

  it.each(['Gym 17', 'Gym 25:00', 'Gym 13pm', 'Gym for 45 min'])('"%s" has no time', (text) => {
    const result = parse(text);
    expect(result.due).toBeUndefined();
    expect(result.content).toBe(text);
  });
});

describe('parseQuickAdd — projects, sections, labels, priority, people, reminders, deadline', () => {
  it('matches multi-word projects case-insensitively and keeps the known name', () => {
    const result = parse('buy milk #personal errands');
    expect(result.projectName).toBe('Personal Errands');
    expect(result.content).toBe('buy milk');
  });

  it('does not recognise unknown projects or sections', () => {
    const result = parse('Plan #Nope /Foo');
    expect(result.projectName).toBeUndefined();
    expect(result.sectionName).toBeUndefined();
    expect(result.content).toBe('Plan #Nope /Foo');
  });

  it('matches a section of the current project', () => {
    const result = parse('Plan /long term #Work');
    expect(result.sectionName).toBe('Long term');
    expect(result.projectName).toBe('Work');
    expect(result.content).toBe('Plan');
  });

  it('takes % and @ labels, several of them, without duplicates', () => {
    const result = parse('Clean @home %chores %home');
    expect(result.labels).toEqual(['home', 'chores']);
    expect(result.content).toBe('Clean');
  });

  it('accepts p1–p4 in any case, not p5', () => {
    expect(parse('Ship P2').priority).toBe(2);
    expect(parse('Ship p4').priority).toBe(4);
    const p5 = parse('Ship p5');
    expect(p5.priority).toBeUndefined();
    expect(p5.content).toBe('Ship p5');
  });

  it('a token must start a word: e-mails and hashes inside words stay text', () => {
    const result = parse('mail a@b.com about abc#1 and x/y');
    expect(result.tokens).toEqual([]);
    expect(result.content).toBe('mail a@b.com about abc#1 and x/y');
  });

  it('recognises +person but keeps it in the name until assignees exist (M8b)', () => {
    const result = parse('Call +anna');
    expect(result.assignee).toBe('anna');
    expect(result.tokens[0]).toMatchObject({ kind: 'assignee', text: '+anna' });
    expect(result.content).toBe('Call +anna');
  });

  it.each([
    ['tomorrow 5pm !30 min before', [{ type: 'RELATIVE', minuteOffset: 30 }]],
    ['tomorrow 5pm !1h before', [{ type: 'RELATIVE', minuteOffset: 60 }]],
    ['tomorrow !5pm', [{ type: 'ABSOLUTE', date: null, time: '17:00' }]],
    ['!nov 5 at 9am', [{ type: 'ABSOLUTE', date: '2026-11-05', time: '09:00' }]],
  ])('reminders: %s', (text, reminders) => {
    const result = parse(`Pay ${text}`);
    expect(result.reminders).toEqual(reminders);
    expect(result.content).toBe('Pay');
  });

  it('a lone ! or ! without a time stays text', () => {
    expect(parse('Wow ! nice').reminders).toEqual([]);
    expect(parse('Pay !tomorrow').content).toBe('Pay !tomorrow');
  });

  it('deadline in braces, alongside a due', () => {
    const result = parse('Pay {Nov 5} friday');
    expect(result.deadline).toBe('2026-11-05');
    expect(result.due?.date).toBe('2026-10-30');
    expect(result.content).toBe('Pay');
  });

  it('braces that are not a date stay text', () => {
    const result = parse('Use {xyz} now');
    expect(result.deadline).toBeUndefined();
    expect(result.content).toBe('Use {xyz} now');
  });

  it('only the first priority / project is recognised', () => {
    const result = parse('Do p1 p3 #Work #Inbox');
    expect(result.priority).toBe(1);
    expect(result.projectName).toBe('Work');
    expect(result.content).toBe('Do p3 #Inbox');
  });
});

describe('parseQuickAdd — uncompletable, ignored tokens, smart date off', () => {
  it('"* " at the start marks an uncompletable task and stays in the name, no token', () => {
    const result = parse('* Ghi chu');
    expect(result.uncompletable).toBe(true);
    expect(result.tokens).toEqual([]);
    expect(result.content).toBe('* Ghi chu');
    expect(parse('Not * this').uncompletable).toBe(false);
  });

  it('a dismissed token is left as text (and nothing inside it is recognised)', () => {
    const result = parse('Call tomorrow 9-10 p1', { ignored: new Set(['date:tomorrow 9-10', 'priority:p1']) });
    expect(result.due).toBeUndefined();
    expect(result.priority).toBeUndefined();
    expect(result.tokens).toEqual([]);
    expect(result.content).toBe('Call tomorrow 9-10 p1');
  });

  it('smartDateRecognition off: no dates, times or repeats; the other tokens still work', () => {
    const result = parse('Call tomorrow 5pm every day p1 {friday}', { smartDate: false });
    expect(result.due).toBeUndefined();
    expect(result.recurrence).toBeUndefined();
    expect(result.priority).toBe(1);
    expect(result.deadline).toBe('2026-10-30');
    expect(result.content).toBe('Call tomorrow 5pm every day');
  });

  it('a name made only of tokens is empty', () => {
    expect(parse('tomorrow p1').content).toBe('');
  });
});

describe('parseQuickAdd — repeats (RecurrenceSpec, contract 8.1)', () => {
  it.each([
    ['every day', { freq: 'DAILY', interval: 1, fromCompletion: false }, '2026-10-27'],
    ['every other day', { freq: 'DAILY', interval: 2, fromCompletion: false }, '2026-10-27'],
    ['every monday', { freq: 'WEEKLY', interval: 1, byDay: [{ weekday: 'MO' }], fromCompletion: false }, '2026-11-02'],
    [
      'every mon, wed and fri',
      { freq: 'WEEKLY', interval: 1, byDay: [{ weekday: 'MO' }, { weekday: 'WE' }, { weekday: 'FR' }], fromCompletion: false },
      '2026-10-28',
    ],
    ['every other week', { freq: 'WEEKLY', interval: 2, fromCompletion: false }, '2026-10-27'],
    [
      'every weekday',
      {
        freq: 'WEEKLY',
        interval: 1,
        byDay: ['MO', 'TU', 'WE', 'TH', 'FR'].map((weekday) => ({ weekday })),
        fromCompletion: false,
      },
      '2026-10-27',
    ],
    ['every 3rd friday', { freq: 'MONTHLY', interval: 1, byDay: [{ weekday: 'FR', ordinal: 3 }], fromCompletion: false }, '2026-11-20'],
    ['every last friday', { freq: 'MONTHLY', interval: 1, byDay: [{ weekday: 'FR', ordinal: -1 }], fromCompletion: false }, '2026-10-30'],
    ['every last day', { freq: 'MONTHLY', interval: 1, byMonthDay: [-1], fromCompletion: false }, '2026-10-31'],
    [
      'every last workday',
      {
        freq: 'MONTHLY',
        interval: 1,
        byDay: ['MO', 'TU', 'WE', 'TH', 'FR'].map((weekday) => ({ weekday })),
        bySetPos: -1,
        fromCompletion: false,
      },
      '2026-10-30',
    ],
    ['every 15th', { freq: 'MONTHLY', interval: 1, byMonthDay: [15], fromCompletion: false }, '2026-11-15'],
    ['every! 3 months', { freq: 'MONTHLY', interval: 3, fromCompletion: true }, '2026-10-27'],
    ['every 2 weeks', { freq: 'WEEKLY', interval: 2, fromCompletion: false }, '2026-10-27'],
    ['every year', { freq: 'YEARLY', interval: 1, fromCompletion: false }, '2026-10-27'],
    ['every jan 5', { freq: 'YEARLY', interval: 1, byMonth: [1], byMonthDay: [5], fromCompletion: false }, '2027-01-05'],
  ])('%s', (text, recurrence, firstDate) => {
    const result = parse(`Water plants ${text}`);
    expect(result.recurrence).toEqual(recurrence);
    expect(result.due?.date).toBe(firstDate);
    expect(result.content).toBe('Water plants');
  });

  it('time after the repeat goes into the due', () => {
    const result = parse('Standup every weekday at 9am');
    expect(result.due).toEqual({ date: '2026-10-27', time: '09:00', durationMinutes: null });
    expect(result.tokens.map((token) => token.text)).toEqual(['every weekday at 9am']);
  });

  it('starting / until become the first due and untilDate', () => {
    const result = parse('Run every day starting nov 5 until dec 1');
    expect(result.recurrence).toEqual({ freq: 'DAILY', interval: 1, untilDate: '2026-12-01', fromCompletion: false });
    expect(result.startDate).toBe('2026-11-05');
    expect(result.due?.date).toBe('2026-11-05');
    expect(result.content).toBe('Run');
  });

  it('"for N weeks" turns into untilDate (last day included)', () => {
    const result = parse('Run every day for 3 weeks');
    expect(result.recurrence?.untilDate).toBe('2026-11-16');
  });

  it('"every" alone stays text', () => {
    const result = parse('Read every');
    expect(result.recurrence).toBeUndefined();
    expect(result.content).toBe('Read every');
  });
});

/**
 * 3-letter weekday abbreviations (mon … sun) collide with Vietnamese words ("Thu tiền", "món", "sát"): they count
 * only with a clear English context — after on/next/this/every/starting/until/by, next to a time, inside {…} / !…,
 * or as the whole text (the typed date field). Full names (friday) are unchanged. Default, chờ duyệt.
 */
describe('parseQuickAdd — short weekday names need an English context', () => {
  it.each(['Thu tiền điện', 'thu tien dien', 'Mon ăn ngon', 'sat nhap', 'Pay tue', 'Gặp sun ở quán', 'Pay thu.'])(
    '"%s" has no date',
    (text) => {
      const result = parse(text);
      expect(result.due).toBeUndefined();
      expect(result.content).toBe(text);
    },
  );

  it.each([
    ['Pay on sat', '2026-10-31', null],
    ['Pay on thu.', '2026-10-29', null],
    ['Pay this wed', '2026-10-28', null],
    ['Pay next fri', '2026-11-06', null],
    ['Pay thu 9am', '2026-10-29', '09:00'],
    ['Pay Thu 5pm', '2026-10-29', '17:00'],
    ['Pay 9am thu', '2026-10-29', '09:00'],
    ['Pay thu 9h', '2026-10-29', '09:00'],
    ['Pay friday', '2026-10-30', null],
    ['Pay thursday', '2026-10-29', null],
    ['fri', '2026-10-30', null],
  ])('%s', (text, date, time) => {
    const result = parse(text);
    expect(result.due).toEqual({ date, time, durationMinutes: null });
  });

  it('"by fri": the date is recognised, "by" stays in the name', () => {
    const result = parse('Pay by fri');
    expect(result.due?.date).toBe('2026-10-30');
    expect(result.content).toBe('Pay by');
  });

  it('repeats, modifiers, deadline and reminder keep the abbreviations', () => {
    const every = parse('Gym every thu 9am');
    expect(every.recurrence).toEqual({ freq: 'WEEKLY', interval: 1, byDay: [{ weekday: 'TH' }], fromCompletion: false });
    expect(every.due).toEqual({ date: '2026-10-29', time: '09:00', durationMinutes: null });
    expect(parse('Run every day starting mon').startDate).toBe('2026-11-02');
    expect(parse('Run every day until fri').recurrence?.untilDate).toBe('2026-10-30');
    expect(parse('Pay {thu}').deadline).toBe('2026-10-29');
    expect(parse('Pay tomorrow !thu 9am').reminders).toEqual([{ type: 'ABSOLUTE', date: '2026-10-29', time: '09:00' }]);
  });
});
