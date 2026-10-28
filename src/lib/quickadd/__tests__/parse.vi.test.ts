import { parseQuickAdd, type ParseContext } from '..';

/**
 * Vietnamese Quick Add (VIQA): recognised side by side with English, no setting. "Today" is fixed: Tuesday 2026-10-27.
 * Each word is accepted with its correct diacritics OR fully unaccented ("hôm nay" / "hom nay"), never with OTHER
 * diacritics ("này" ≠ "nay", "một" ≠ "mốt", "mãi" ≠ "mai").
 */
const base: ParseContext = {
  today: '2026-10-27',
  dateSettings: { startDay: 1, nextWeek: 1, weekendStartDay: 6 },
  dateFormat: 'DMY',
  smartDate: true,
  projects: ['Work', 'Việc nhà'],
};

const parse = (text: string, ctx: Partial<ParseContext> = {}) => parseQuickAdd(text, { ...base, ...ctx });
const allDay = (date: string) => ({ date, time: null, durationMinutes: null });
const WORKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR'].map((weekday) => ({ weekday }));

describe('VIQA — dates', () => {
  it.each([
    ['hôm nay', '2026-10-27'],
    ['hom nay', '2026-10-27'],
    ['HÔM NAY', '2026-10-27'],
    ['nay', '2026-10-27'],
    ['mai', '2026-10-28'],
    ['ngày mai', '2026-10-28'],
    ['ngay mai', '2026-10-28'],
    ['vào ngày mai', '2026-10-28'],
    ['mốt', '2026-10-29'],
    ['ngày mốt', '2026-10-29'],
    ['ngay mot', '2026-10-29'],
    ['ngày kia', '2026-10-29'],
    ['ngay kia', '2026-10-29'],
    ['hôm qua', '2026-10-26'],
    ['hom qua', '2026-10-26'],
    ['thứ hai', '2026-11-02'],
    ['thu hai', '2026-11-02'],
    ['thứ ba', '2026-11-03'], // today is Tuesday → the next one (like "tue")
    ['thứ tư', '2026-10-28'],
    ['thu tu', '2026-10-28'],
    ['thứ năm', '2026-10-29'],
    ['thứ sáu', '2026-10-30'],
    ['thu sau', '2026-10-30'],
    ['thứ bảy', '2026-10-31'],
    ['thứ bẩy', '2026-10-31'],
    ['chủ nhật', '2026-11-01'],
    ['chu nhat', '2026-11-01'],
    ['cn', '2026-11-01'],
    ['t2', '2026-11-02'],
    ['T7', '2026-10-31'],
    ['thứ 2', '2026-11-02'],
    ['thứ 6', '2026-10-30'],
    ['vào thứ hai', '2026-11-02'],
    ['thứ sáu này', '2026-10-30'],
    ['thứ hai tới', '2026-11-02'],
    ['thứ sáu tuần sau', '2026-11-06'], // Friday of NEXT week, like "next friday"
    ['thứ 6 tuần tới', '2026-11-06'],
    ['chủ nhật tuần sau', '2026-11-08'],
    ['tuần sau', '2026-11-02'],
    ['tuần tới', '2026-11-02'],
    ['tuan sau', '2026-11-02'],
    ['cuối tuần', '2026-10-31'],
    ['cuoi tuan', '2026-10-31'],
    ['cuối tuần sau', '2026-11-07'],
    ['tháng sau', '2026-11-01'],
    ['tháng tới', '2026-11-01'],
    ['đầu tháng', '2026-11-01'],
    ['đầu tháng sau', '2026-11-01'],
    ['cuối tháng', '2026-10-31'],
    ['ngày cuối tháng', '2026-10-31'],
    ['cuối tháng sau', '2026-11-30'],
    ['15/11', '2026-11-15'],
    ['15/11/2026', '2026-11-15'],
    ['ngày 15/11', '2026-11-15'],
    ['ngày 15 tháng 11', '2026-11-15'],
    ['15 tháng 11 năm 2027', '2027-11-15'],
    ['ngày 15', '2026-11-15'], // the 15th already passed this month
    ['ngày 30', '2026-10-30'],
    ['ngày 27', '2026-10-27'],
    ['ngay 5', '2026-11-05'],
    ['sau 3 ngày', '2026-10-30'],
    ['sau 2 tuần', '2026-11-10'],
    ['3 ngày nữa', '2026-10-30'],
    ['3 ngay nua', '2026-10-30'],
    ['1 tháng nữa', '2026-11-27'],
    ['3 ngày sau', '2026-10-30'],
  ])('%s → %s', (text, date) => {
    const result = parse(`Nộp báo cáo ${text}`);
    expect(result.due).toEqual(allDay(date));
    expect(result.content).toBe('Nộp báo cáo');
  });

  it('"ngày D/M" is always day/month, even when the account uses MDY', () => {
    expect(parse('Nộp ngày 15/11', { dateFormat: 'MDY' }).due?.date).toBe('2026-11-15');
  });

  it('"ngày 31" skips months without a 31st', () => {
    expect(parse('Nộp ngày 31', { today: '2026-11-05' }).due?.date).toBe('2026-12-31');
  });

  it('"đầu tháng" on the 1st is that day', () => {
    expect(parse('Nộp đầu tháng', { today: '2026-11-01' }).due?.date).toBe('2026-11-01');
  });

  it('a date at the very start of the text: "Mai họp nhóm"', () => {
    const result = parse('Mai họp nhóm');
    expect(result.due).toEqual(allDay('2026-10-28'));
    expect(result.content).toBe('họp nhóm');
  });

  it('"Gọi mẹ mai" → tomorrow', () => {
    expect(parse('Gọi mẹ mai').due?.date).toBe('2026-10-28');
  });
});

describe('VIQA — times, day parts and durations', () => {
  it.each([
    ['7h', '2026-10-27', '07:00'],
    ['7h30', '2026-10-27', '07:30'],
    ['7h05', '2026-10-27', '07:05'],
    ['7 giờ', '2026-10-27', '07:00'],
    ['7 gio', '2026-10-27', '07:00'],
    ['7 giờ 30', '2026-10-27', '07:30'],
    ['7 giờ 30 phút', '2026-10-27', '07:30'],
    ['7 giờ rưỡi', '2026-10-27', '07:30'],
    ['7h sáng', '2026-10-27', '07:00'],
    ['7h30 sáng', '2026-10-27', '07:30'],
    ['7 giờ chiều', '2026-10-27', '19:00'],
    ['7 giờ tối', '2026-10-27', '19:00'],
    ['7 gio toi', '2026-10-27', '19:00'],
    ['7h tối', '2026-10-27', '19:00'],
    ['12h trưa', '2026-10-27', '12:00'],
    ['11h đêm', '2026-10-27', '23:00'],
    ['19h', '2026-10-27', '19:00'],
    ['19h30', '2026-10-27', '19:30'],
    ['7:30', '2026-10-27', '07:30'],
    ['7:30 tối', '2026-10-27', '19:30'],
    ['lúc 7', '2026-10-27', '07:00'],
    ['lúc 7:30 tối', '2026-10-27', '19:30'],
    ['mai 7h', '2026-10-28', '07:00'],
    ['mai lúc 9h', '2026-10-28', '09:00'],
    ['9h sáng mai', '2026-10-28', '09:00'],
    ['sáng mai', '2026-10-28', '09:00'],
    ['trưa nay', '2026-10-27', '12:00'],
    ['chiều mai', '2026-10-28', '15:00'],
    ['tối nay', '2026-10-27', '19:00'],
    ['toi nay', '2026-10-27', '19:00'],
    ['mai tối', '2026-10-28', '19:00'],
    ['tối mai 8h', '2026-10-28', '20:00'],
    ['chiều thứ sáu 3h', '2026-10-30', '15:00'],
    ['thứ hai tuần sau 9h', '2026-11-02', '09:00'],
  ])('%s → %s %s', (text, date, time) => {
    const result = parse(`Họp ${text}`);
    expect(result.due).toEqual({ date, time, durationMinutes: null });
    expect(result.content).toBe('Họp');
  });

  it.each([
    ['9-10h', '09:00', 60],
    ['9h-10h30', '09:00', 90],
    ['9h - 10h', '09:00', 60],
    ['2-4h chiều', '14:00', 120],
    ['11h-1h chiều', '11:00', 120],
    ['từ 9h đến 11h', '09:00', 120],
    ['9h trong 1 tiếng', '09:00', 60],
    ['9h trong 1 tiếng 30 phút', '09:00', 90],
    ['9h 1 tiếng 30 phút', '09:00', 90],
    ['9h trong 45 phút', '09:00', 45],
    ['9h trong 2 giờ', '09:00', 120],
    ['9h 1 tiếng rưỡi', '09:00', 90],
    ['9h trong 1,5 tiếng', '09:00', 90],
    ['9h trong 1 tieng', '09:00', 60],
  ])('range / duration %s', (text, time, durationMinutes) => {
    const result = parse(`Họp ${text}`);
    expect(result.due).toEqual({ date: '2026-10-27', time, durationMinutes });
    expect(result.content).toBe('Họp');
  });

  it('"9h 45 phút" is 9:45 (hour + minutes), not a duration', () => {
    expect(parse('Họp 9h 45 phút').due).toEqual({ date: '2026-10-27', time: '09:45', durationMinutes: null });
  });

  it('"9h-10h30 mai" — range then date', () => {
    expect(parse('Họp 9h-10h30 mai').due).toEqual({ date: '2026-10-28', time: '09:00', durationMinutes: 90 });
  });

  it('a day part with no date is text: "Ăn sáng 7h" keeps "Ăn sáng"', () => {
    const result = parse('Ăn sáng 7h');
    expect(result.due).toEqual({ date: '2026-10-27', time: '07:00', durationMinutes: null });
    expect(result.content).toBe('Ăn sáng');
  });

  it('unaccented "sang" is never the morning (it is the verb "sang"): "7h sang nha ban"', () => {
    const result = parse('Gym 7h sang nha ban');
    expect(result.due?.time).toBe('07:00');
    expect(result.content).toBe('Gym sang nha ban');
  });
});

describe('VIQA — repeats (RecurrenceSpec)', () => {
  it.each([
    ['mỗi ngày', { freq: 'DAILY', interval: 1, fromCompletion: false }, '2026-10-27'],
    ['moi ngay', { freq: 'DAILY', interval: 1, fromCompletion: false }, '2026-10-27'],
    ['hằng ngày', { freq: 'DAILY', interval: 1, fromCompletion: false }, '2026-10-27'],
    ['hàng ngày', { freq: 'DAILY', interval: 1, fromCompletion: false }, '2026-10-27'],
    ['hang ngay', { freq: 'DAILY', interval: 1, fromCompletion: false }, '2026-10-27'],
    ['mỗi tuần', { freq: 'WEEKLY', interval: 1, fromCompletion: false }, '2026-10-27'],
    ['moi tuan', { freq: 'WEEKLY', interval: 1, fromCompletion: false }, '2026-10-27'],
    ['mỗi tháng', { freq: 'MONTHLY', interval: 1, fromCompletion: false }, '2026-10-27'],
    ['mỗi năm', { freq: 'YEARLY', interval: 1, fromCompletion: false }, '2026-10-27'],
    ['hằng năm', { freq: 'YEARLY', interval: 1, fromCompletion: false }, '2026-10-27'],
    ['mỗi thứ hai', { freq: 'WEEKLY', interval: 1, byDay: [{ weekday: 'MO' }], fromCompletion: false }, '2026-11-02'],
    ['moi thu hai', { freq: 'WEEKLY', interval: 1, byDay: [{ weekday: 'MO' }], fromCompletion: false }, '2026-11-02'],
    ['hằng tuần vào thứ hai', { freq: 'WEEKLY', interval: 1, byDay: [{ weekday: 'MO' }], fromCompletion: false }, '2026-11-02'],
    [
      'mỗi t2 và t5',
      { freq: 'WEEKLY', interval: 1, byDay: [{ weekday: 'MO' }, { weekday: 'TH' }], fromCompletion: false },
      '2026-10-29',
    ],
    [
      'mỗi thứ 2, 4, 6',
      { freq: 'WEEKLY', interval: 1, byDay: [{ weekday: 'MO' }, { weekday: 'WE' }, { weekday: 'FR' }], fromCompletion: false },
      '2026-10-28',
    ],
    [
      'mỗi thứ hai, thứ tư và thứ sáu',
      { freq: 'WEEKLY', interval: 1, byDay: [{ weekday: 'MO' }, { weekday: 'WE' }, { weekday: 'FR' }], fromCompletion: false },
      '2026-10-28',
    ],
    ['mỗi 2 tuần', { freq: 'WEEKLY', interval: 2, fromCompletion: false }, '2026-10-27'],
    ['mỗi 3 tháng', { freq: 'MONTHLY', interval: 3, fromCompletion: false }, '2026-10-27'],
    ['cách tuần', { freq: 'WEEKLY', interval: 2, fromCompletion: false }, '2026-10-27'],
    ['cach tuan', { freq: 'WEEKLY', interval: 2, fromCompletion: false }, '2026-10-27'],
    ['cách ngày', { freq: 'DAILY', interval: 2, fromCompletion: false }, '2026-10-27'],
    ['mỗi ngày làm việc', { freq: 'WEEKLY', interval: 1, byDay: WORKDAYS, fromCompletion: false }, '2026-10-27'],
    ['moi ngay lam viec', { freq: 'WEEKLY', interval: 1, byDay: WORKDAYS, fromCompletion: false }, '2026-10-27'],
    ['các ngày trong tuần', { freq: 'WEEKLY', interval: 1, byDay: WORKDAYS, fromCompletion: false }, '2026-10-27'],
    ['mỗi tháng ngày 15', { freq: 'MONTHLY', interval: 1, byMonthDay: [15], fromCompletion: false }, '2026-11-15'],
    ['ngày 15 hằng tháng', { freq: 'MONTHLY', interval: 1, byMonthDay: [15], fromCompletion: false }, '2026-11-15'],
    ['mỗi ngày cuối tháng', { freq: 'MONTHLY', interval: 1, byMonthDay: [-1], fromCompletion: false }, '2026-10-31'],
    ['ngày cuối mỗi tháng', { freq: 'MONTHLY', interval: 1, byMonthDay: [-1], fromCompletion: false }, '2026-10-31'],
    [
      'mỗi thứ sáu cuối tháng',
      { freq: 'MONTHLY', interval: 1, byDay: [{ weekday: 'FR', ordinal: -1 }], fromCompletion: false },
      '2026-10-30',
    ],
    [
      'mỗi ngày làm việc cuối tháng',
      { freq: 'MONTHLY', interval: 1, byDay: WORKDAYS, bySetPos: -1, fromCompletion: false },
      '2026-10-30',
    ],
    [
      'mỗi năm ngày 15/11',
      { freq: 'YEARLY', interval: 1, byMonth: [11], byMonthDay: [15], fromCompletion: false },
      '2026-11-15',
    ],
    ['mỗi! 3 ngày', { freq: 'DAILY', interval: 3, fromCompletion: true }, '2026-10-27'],
    ['hằng! tuần', { freq: 'WEEKLY', interval: 1, fromCompletion: true }, '2026-10-27'],
  ])('%s', (text, recurrence, firstDate) => {
    const result = parse(`Tưới cây ${text}`);
    expect(result.recurrence).toEqual(recurrence);
    expect(result.due?.date).toBe(firstDate);
    expect(result.content).toBe('Tưới cây');
  });

  it.each([
    ['mỗi sáng', '2026-10-27', '09:00'],
    ['mỗi tối 9h', '2026-10-27', '21:00'],
    ['mỗi thứ hai 9h', '2026-11-02', '09:00'],
    ['mỗi thứ hai tối 8h', '2026-11-02', '20:00'],
    ['mỗi ngày lúc 7:30', '2026-10-27', '07:30'],
  ])('time with a repeat: %s', (text, date, time) => {
    const result = parse(`Tập ${text}`);
    expect(result.due).toEqual({ date, time, durationMinutes: null });
    expect(result.content).toBe('Tập');
  });

  it('"bắt đầu từ …" and "đến …" become startDate and untilDate', () => {
    const result = parse('Chạy mỗi ngày bắt đầu từ 5/11 đến 1/12');
    expect(result.recurrence).toEqual({ freq: 'DAILY', interval: 1, untilDate: '2026-12-01', fromCompletion: false });
    expect(result.startDate).toBe('2026-11-05');
    expect(result.due?.date).toBe('2026-11-05');
    expect(result.content).toBe('Chạy');
  });

  it.each<[string, { startDate?: string; untilDate?: string }]>([
    ['Chạy mỗi ngày từ thứ hai', { startDate: '2026-11-02' }],
    ['Chạy mỗi ngày cho tới cuối tháng', { untilDate: '2026-10-31' }],
    ['Chạy moi ngay den 1/12', { untilDate: '2026-12-01' }],
    ['Chạy mỗi ngày trong 3 tuần', { untilDate: '2026-11-16' }],
  ])('modifier: %s', (text, expected) => {
    const result = parse(text);
    if (expected.startDate) expect(result.startDate).toBe(expected.startDate);
    if (expected.untilDate) expect(result.recurrence?.untilDate).toBe(expected.untilDate);
    expect(result.content).toBe('Chạy');
  });

  it('"từ 9h đến 10h" after a repeat is a time range, not a start date', () => {
    const result = parse('Học mỗi ngày từ 9h đến 10h');
    expect(result.due).toEqual({ date: '2026-10-27', time: '09:00', durationMinutes: 60 });
    expect(result.recurrence?.freq).toBe('DAILY');
  });
});

describe('VIQA — reminders, deadline, priority, mixed with English', () => {
  it.each([
    ['mai 9h !30 phút trước', [{ type: 'RELATIVE', minuteOffset: 30 }]],
    ['mai 9h !30 phut truoc', [{ type: 'RELATIVE', minuteOffset: 30 }]],
    ['mai 9h !30p trước', [{ type: 'RELATIVE', minuteOffset: 30 }]],
    ['mai 9h !1 tiếng trước', [{ type: 'RELATIVE', minuteOffset: 60 }]],
    ['mai 9h !2 giờ trước', [{ type: 'RELATIVE', minuteOffset: 120 }]],
    ['mai 9h !1 tiếng 30 phút trước', [{ type: 'RELATIVE', minuteOffset: 90 }]],
    ['mai 9h !1 ngày trước', [{ type: 'RELATIVE', minuteOffset: 1440 }]],
    ['!mai 9h', [{ type: 'ABSOLUTE', date: '2026-10-28', time: '09:00' }]],
    ['mai !7h tối', [{ type: 'ABSOLUTE', date: null, time: '19:00' }]],
  ])('reminders: %s', (text, reminders) => {
    const result = parse(`Họp ${text}`);
    expect(result.reminders).toEqual(reminders);
    expect(result.content).toBe('Họp');
  });

  it.each([
    ['{thứ sáu}', '2026-10-30'],
    ['{thu sau}', '2026-10-30'],
    ['{cuối tháng}', '2026-10-31'],
    ['{15/11}', '2026-11-15'],
    ['{ngày mai}', '2026-10-28'],
    ['{Mai}', '2026-10-28'],
  ])('deadline %s', (text, deadline) => {
    const result = parse(`Nộp ${text}`);
    expect(result.deadline).toBe(deadline);
    expect(result.content).toBe('Nộp');
  });

  it('a deadline cannot carry a time: "{mai 9h}" is not a deadline (same as "{tomorrow 5pm}")', () => {
    expect(parse('Nộp {mai 9h}').deadline).toBeUndefined();
    expect(parse('Nộp {tomorrow 5pm}').deadline).toBeUndefined();
  });

  it('every field at once, in Vietnamese', () => {
    const result = parse('Họp nhóm sáng mai 9-10h #việc nhà p1 %gấp {thứ sáu} !30 phút trước');
    expect(result.content).toBe('Họp nhóm');
    expect(result.due).toEqual({ date: '2026-10-28', time: '09:00', durationMinutes: 60 });
    expect(result.projectName).toBe('Việc nhà');
    expect(result.priority).toBe(1);
    expect(result.labels).toEqual(['gấp']);
    expect(result.deadline).toBe('2026-10-30');
    expect(result.reminders).toEqual([{ type: 'RELATIVE', minuteOffset: 30 }]);
    expect(result.tokens.map((token) => [token.kind, token.text])).toEqual([
      ['date', 'sáng mai 9-10h'],
      ['project', '#việc nhà'],
      ['priority', 'p1'],
      ['label', '%gấp'],
      ['deadline', '{thứ sáu}'],
      ['reminder', '!30 phút trước'],
    ]);
  });

  it('token offsets point into the original (accented) text — highlighting works unchanged', () => {
    const [token] = parse('Gọi điện hôm nay 9h').tokens;
    expect(token).toMatchObject({ kind: 'date', start: 9, end: 19, text: 'hôm nay 9h', key: 'date:hôm nay 9h' });
  });

  it.each([
    ['Họp tomorrow 9h', { date: '2026-10-28', time: '09:00', durationMinutes: null }],
    ['Họp mai 5pm', { date: '2026-10-28', time: '17:00', durationMinutes: null }],
    ['Họp mai 9-10', { date: '2026-10-28', time: '09:00', durationMinutes: 60 }],
    ['Họp friday 7h tối', { date: '2026-10-30', time: '19:00', durationMinutes: null }],
    ['Họp thứ sáu at 3pm', { date: '2026-10-30', time: '15:00', durationMinutes: null }],
    ['Họp next friday 9h', { date: '2026-11-06', time: '09:00', durationMinutes: null }],
  ])('mixed: %s', (text, due) => {
    const result = parse(text);
    expect(result.due).toEqual(due);
    expect(result.content).toBe('Họp');
  });

  it('mixed repeats: "every monday 7h" and "mỗi thứ hai at 7am"', () => {
    for (const text of ['Gym every monday 7h', 'Gym mỗi thứ hai at 7am']) {
      const result = parse(text);
      expect(result.recurrence?.byDay).toEqual([{ weekday: 'MO' }]);
      expect(result.due).toEqual({ date: '2026-11-02', time: '07:00', durationMinutes: null });
    }
  });

  it('"9h p1": the "p" of a priority is not minutes', () => {
    const result = parse('Họp 9h p1');
    expect(result.due?.time).toBe('09:00');
    expect(result.priority).toBe(1);
    expect(result.content).toBe('Họp');
  });

  it('smart date off: Vietnamese dates stay text too', () => {
    const result = parse('Họp mai 9h p2', { smartDate: false });
    expect(result.due).toBeUndefined();
    expect(result.priority).toBe(2);
    expect(result.content).toBe('Họp mai 9h');
  });
});

describe('VIQA — ordinary words are NOT dates (negative cases)', () => {
  it.each([
    'Gọi chị Mai',
    'gọi chị mai',
    'Gặp Mai ở quán',
    'Mua hoa mai',
    'Chụp ảnh cành mai',
    'mai mốt đi chơi',
    'Nghĩ về mai sau',
    'Học thương mại',
    'Mãi mãi bên nhau',
    'Làm việc này',
    'Từ xưa đến nay',
    'Năm nay vui',
    'Mua một cái áo',
    'mua mot cai ao',
    'Mua mốt mới',
    'Đi ăn trưa',
    'Ánh sáng',
    'Sáng tạo nội dung',
    'Mua vé 2 chiều',
    'Đọc chương thứ hai',
    'Thi lần thứ 3',
    'Mỗi người một việc',
    'Đọc trong 3 tuần',
    'Họp trong 1 tiếng',
    'Nộp ngày',
    'Phòng 15',
    'Gym 25h',
    'Gym 7h75',
    'Tìm cách làm',
    'Xem thứ',
  ])('"%s" has no date', (text) => {
    const result = parse(text);
    expect(result.due).toBeUndefined();
    expect(result.recurrence).toBeUndefined();
    expect(result.content).toBe(text);
  });

  it('a capitalised name is skipped but a later lower-case "mai" is still tomorrow', () => {
    const result = parse('Chị Mai mai 9h');
    expect(result.due).toEqual({ date: '2026-10-28', time: '09:00', durationMinutes: null });
    expect(result.content).toBe('Chị Mai');
  });

  it('"!30 phút" without "trước" is not a reminder', () => {
    const result = parse('Họp !30 phút');
    expect(result.reminders).toEqual([]);
  });
});
