import { addDays, addMonthsClamped, quickDates, weekStart } from '../dates';
import type { RecurrenceSpec, Weekday } from '../recurrence/types';
import {
  END,
  RRULE_DAYS,
  WORKDAYS,
  addUnits,
  at,
  dateKey,
  daysInMonth,
  emptySpec,
  explicitYear,
  inferYear,
  nextWeekday,
  pad,
  sticky,
  toMinutes,
  type DayPart,
  type Phrase,
} from './shared';
import type { ParseContext } from './types';

/**
 * Vietnamese date grammar of Quick Add (VIQA), recognised side by side with English (no setting). Works on the
 * LOWER-CASED text, offsets equal to the original text, every phrase ends at a word boundary.
 *
 * Diacritics rule: each word is accepted with its correct diacritics OR fully unaccented ("hôm nay" / "hom nay"),
 * never with other diacritics — so "này" is not "nay", "một" is not "mốt", "mãi" / "mại" are not "mai".
 * Ambiguous single words ("mai", "nay", "mốt", day parts, "thứ hai") also check the neighbouring words.
 */

/** Lower-case Vietnamese letters with diacritics → base letter (explicit table: no String.normalize on Hermes). */
const BASE_LETTER: Record<string, string> = Object.fromEntries(
  Object.entries({
    a: 'àáạảãâầấậẩẫăằắặẳẵ',
    e: 'èéẹẻẽêềếệểễ',
    i: 'ìíịỉĩ',
    o: 'òóọỏõôồốộổỗơờớợởỡ',
    u: 'ùúụủũưừứựửữ',
    y: 'ỳýỵỷỹ',
    d: 'đ',
  }).flatMap(([base, letters]) => [...letters].map((letter) => [letter, base])),
);

/** Strips Vietnamese diacritics ("đ" → "d"). Input is lower case, precomposed (NFC, what keyboards type). */
export function fold(value: string): string {
  return [...value].map((char) => BASE_LETTER[char] ?? char).join('');
}

/** One word: its correct spelling or fully unaccented. */
function w(word: string): string {
  const plain = fold(word);
  return plain === word ? word : `(?:${word}|${plain})`;
}

/** Words separated by spaces. */
function ph(phrase: string): string {
  return phrase.split(' ').map(w).join('\\s+');
}

/** Any of the phrases (longest first). */
function any(...phrases: string[]): string {
  return `(?:${[...phrases].sort((a, b) => b.length - a.length).map(ph).join('|')})`;
}

/** A set holding each word and its unaccented form. */
function words(...list: string[]): ReadonlySet<string> {
  return new Set(list.flatMap((word) => [word, fold(word)]));
}

const PUNCTUATION = /[,.;:!?()[\]{}"']/g;

function prevWord(text: string, index: number): string {
  let stop = index;
  while (stop > 0 && /\s/.test(text[stop - 1])) stop -= 1;
  let start = stop;
  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
  return text.slice(start, stop).replace(PUNCTUATION, '');
}

function nextWord(text: string, index: number): string {
  let start = index;
  while (start < text.length && /\s/.test(text[start])) start += 1;
  let stop = start;
  while (stop < text.length && !/\s/.test(text[stop])) stop += 1;
  return text.slice(start, stop).replace(PUNCTUATION, '');
}

// ---- context rules for ambiguous words ------------------------------------------------------------------------------

/** "mai" after these is a name or the apricot flower ("chị Mai", "hoa mai"), not "tomorrow". */
const MAI_PREV = words(
  'hoa', 'cành', 'cây', 'chị', 'anh', 'em', 'cô', 'bà', 'ông', 'bé', 'chú', 'bác', 'dì', 'cậu', 'thầy', 'bạn', 'tên',
  'nàng', 'nguyễn', 'trần', 'phạm', 'hoàng', 'vũ', 'võ', 'đặng', 'bùi', 'ngô', 'dương', 'thương', 'nay',
);
/** "mai mốt", "mai sau", "mai kia", "mai này" = some day (vague), not tomorrow. */
const MAI_NEXT = new Set(['mốt', 'mot', 'sau', 'kia', 'này', 'nay', 'mai']);
/** "xưa nay", "từ nay", "đến nay", "năm nay" … are not "today". */
const NAY_PREV = new Set([
  ...words('xưa', 'từ', 'đến', 'bấy', 'lâu', 'gần', 'dạo', 'năm', 'tháng', 'tuần', 'hồi', 'cho'),
  'tới', // not its unaccented "toi": "toi nay" is "tối nay" (tonight)
]);
const NAY_NEXT = new Set(['mai']);
/** "mai mốt", "lỗi mốt", "mốt mới" = fashion / vague. Bare "mốt" needs its diacritics ("mot" is "một"). */
const MOT_PREV = words('mai', 'lỗi', 'theo', 'hợp', 'đúng', 'chạy');
const MOT_NEXT = words('mới', 'này');
/** "ăn sáng", "bữa trưa", "ánh sáng" are not day parts. */
const DAY_PART_PREV = words('ăn', 'bữa', 'buổi', 'ánh', 'trời');
/** "lần thứ hai", "chương thứ 3" are ordinals, not weekdays. */
const ORDINAL_PREV = words(
  'lần', 'chương', 'bài', 'phần', 'tập', 'người', 'câu', 'trang', 'lớp', 'hạng', 'giải', 'kỳ', 'kì', 'khóa', 'khoá',
  'ngày', 'tuần', 'tháng', 'năm', 'con', 'vòng', 'số', 'cấp', 'đợt', 'buổi', 'tiết', 'bước', 'mục', 'điều', 'khoản',
  'đứng', 'hiệp', 'quý', 'cuộc', 'đời', 'thế', 'vị', 'trí', 'học',
);

// ---- vocabulary -----------------------------------------------------------------------------------------------------

const WEEKDAY_WORDS: Record<string, number> = { hai: 1, ba: 2, tu: 3, nam: 4, sau: 5, bay: 6 };
const WEEKDAY = `(${w('thứ')}(?:\\s+(?:${['hai', 'ba', 'tư', 'năm', 'sáu', 'bảy', 'bẩy'].map(w).join('|')})|\\s*[2-7])|${any('chủ nhật', 'chúa nhật')}|cn|t[2-7])`;

/** ISO weekday (1 = Monday) of a matched weekday. */
function weekdayOf(raw: string): number {
  const plain = fold(raw).replace(/\s+/g, ' ');
  const digit = /([2-7])$/.exec(plain);
  if (digit) return Number(digit[1]) - 1;
  const word = /^thu (\w+)$/.exec(plain);
  return word ? WEEKDAY_WORDS[word[1]] : 7;
}

const weekdayCode = (raw: string): Weekday => RRULE_DAYS[weekdayOf(raw) - 1];
const isOrdinalForm = (raw: string) => fold(raw).startsWith('thu');

const UNIT = `(${['ngày', 'tuần', 'tháng', 'năm'].map(w).join('|')})`;
const UNIT_EN: Record<string, string> = { ngay: 'days', tuan: 'weeks', thang: 'months', nam: 'years' };
const unitEn = (raw: string) => UNIT_EN[fold(raw)];
const FREQ: Record<string, RecurrenceSpec['freq']> = { ngay: 'DAILY', tuan: 'WEEKLY', thang: 'MONTHLY', nam: 'YEARLY' };

/** "sáng" only with its diacritics: unaccented "sang" is the verb "sang" (go over). */
const DAY_PART = `(sáng|${w('trưa')}|${w('chiều')}|${w('tối')}|${w('đêm')})`;
const DAY_PART_OF: Record<string, DayPart> = {
  sang: 'morning', trua: 'noon', chieu: 'afternoon', toi: 'evening', dem: 'night',
};
const dayPartOf = (raw: string) => DAY_PART_OF[fold(raw)];
export const DAY_PART_TIME: Record<DayPart, string> = {
  morning: '09:00', noon: '12:00', afternoon: '15:00', evening: '19:00', night: '22:00',
};

const VAO = `(?:${w('vào')}\\s+)?`;
const THIS_NEXT = `(?:\\s+(${any('này', 'sau', 'tới')}))?`;
const isNext = (raw: string | undefined) => raw !== undefined && ['sau', 'toi'].includes(fold(raw));

// ---- dates ----------------------------------------------------------------------------------------------------------

const D = {
  today: sticky(`${VAO}${any('hôm nay', 'bữa nay')}${END}`),
  tomorrow: sticky(`${VAO}${ph('ngày mai')}${END}`),
  dayAfter: sticky(`${VAO}${any('ngày mốt', 'ngày kia')}${END}`),
  yesterday: sticky(`${VAO}${ph('hôm qua')}${END}`),
  weekday: sticky(
    `${VAO}${WEEKDAY}(?:\\s+(${w('tuần')}\\s+(?:sau|tới|toi))|\\s+(?:${w('tuần')}\\s+)?(?:${w('này')}|tới))?${END}`,
  ),
  nextWeek: sticky(`${VAO}${w('tuần')}\\s+(?:sau|tới|toi)${END}`),
  weekend: sticky(`${VAO}${ph('cuối tuần')}${THIS_NEXT}${END}`),
  monthStart: sticky(`${VAO}${ph('đầu tháng')}${THIS_NEXT}${END}`),
  monthEnd: sticky(`${VAO}(?:${w('ngày')}\\s+)?${ph('cuối tháng')}${THIS_NEXT}${END}`),
  nextMonth: sticky(`${VAO}${w('tháng')}\\s+(?:sau|tới|toi)${END}`),
  after: sticky(`${VAO}sau\\s+(\\d{1,3})\\s+${UNIT}${END}`),
  later: sticky(`${VAO}(\\d{1,3})\\s+${UNIT}\\s+(?:${w('nữa')}|sau)${END}`),
  dmy: sticky(`${VAO}${w('ngày')}\\s+(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?${END}`),
  dayMonthWords: sticky(
    `${VAO}(?:${w('ngày')}\\s+)?(\\d{1,2})\\s+${w('tháng')}\\s+(\\d{1,2})(?:\\s+${w('năm')}\\s+(\\d{4}))?${END}`,
  ),
  dayOfMonth: sticky(`${VAO}${w('ngày')}\\s+(\\d{1,2})${END}`),
  mai: sticky(`mai${END}`),
  nay: sticky(`nay${END}`),
  mot: sticky(`mốt${END}`),
};

const firstOfNextMonth = (today: string) => addMonthsClamped(`${today.slice(0, 8)}01`, 1);

function lastOfMonth(day: string): string {
  const [year, month] = [Number(day.slice(0, 4)), Number(day.slice(5, 7))];
  return `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`;
}

/** Next day `day` of a month, on or after today (skips months without it). */
function nextMonthDay(today: string, day: number): string | null {
  if (day < 1 || day > 31) return null;
  for (let offset = 0; offset < 12; offset += 1) {
    const month = addMonthsClamped(`${today.slice(0, 8)}01`, offset);
    const key = dateKey(Number(month.slice(0, 4)), Number(month.slice(5, 7)), day);
    if (key && key >= today) return key;
  }
  return null;
}

/** "Mai" written with a capital letter inside the text is a name. */
function isCapitalised(source: string | undefined, text: string, index: number): boolean {
  if (!source || source[index] === text[index]) return false;
  return source.slice(0, index).replace(/^\*\s/, '').trim() !== '';
}

/** One Vietnamese date-only phrase at `index`. `source` = the original-case text (capitalised names). */
export function matchDateVi(text: string, index: number, ctx: ParseContext, source?: string): Phrase | null {
  const { today } = ctx;
  let m: RegExpExecArray | null;
  const end = (match: RegExpExecArray) => index + match[0].length;
  const found = (match: RegExpExecArray, date: string | null) => (date ? { end: end(match), date } : null);
  if ((m = at(D.today, text, index))) return found(m, today);
  if ((m = at(D.tomorrow, text, index))) return found(m, addDays(today, 1));
  if ((m = at(D.dayAfter, text, index))) return found(m, addDays(today, 2));
  if ((m = at(D.yesterday, text, index))) return found(m, addDays(today, -1));
  if ((m = at(D.weekday, text, index))) {
    if (isOrdinalForm(m[1]) && ORDINAL_PREV.has(prevWord(text, index))) return null;
    const target = weekdayOf(m[1]);
    if (m[2]) {
      const start = addDays(weekStart(today, ctx.dateSettings.startDay), 7);
      return found(m, addDays(start, (target - ctx.dateSettings.startDay + 7) % 7));
    }
    return found(m, nextWeekday(today, target));
  }
  if ((m = at(D.nextWeek, text, index))) return found(m, quickDates(today, ctx.dateSettings).nextWeek);
  if ((m = at(D.weekend, text, index))) {
    const weekend = quickDates(today, ctx.dateSettings).thisWeekend;
    return found(m, isNext(m[1]) ? addDays(weekend, 7) : weekend);
  }
  if ((m = at(D.monthStart, text, index))) {
    return found(m, !isNext(m[1]) && today.endsWith('-01') ? today : firstOfNextMonth(today));
  }
  if ((m = at(D.monthEnd, text, index))) {
    return found(m, lastOfMonth(isNext(m[1]) ? firstOfNextMonth(today) : today));
  }
  if ((m = at(D.nextMonth, text, index))) return found(m, firstOfNextMonth(today));
  if ((m = at(D.after, text, index)) || (m = at(D.later, text, index))) {
    const count = Number(m[1]);
    return count > 0 ? found(m, addUnits(today, count, unitEn(m[2]))) : null;
  }
  if ((m = at(D.dmy, text, index))) {
    const year = explicitYear(m[3]);
    const [day, month] = [Number(m[1]), Number(m[2])];
    return found(m, year ? dateKey(year, month, day) : inferYear(month, day, today));
  }
  if ((m = at(D.dayMonthWords, text, index))) {
    const year = explicitYear(m[3]);
    const [day, month] = [Number(m[1]), Number(m[2])];
    return found(m, year ? dateKey(year, month, day) : inferYear(month, day, today));
  }
  if ((m = at(D.dayOfMonth, text, index))) return found(m, nextMonthDay(today, Number(m[1])));
  if ((m = at(D.mai, text, index))) {
    if (isCapitalised(source, text, index) || MAI_PREV.has(prevWord(text, index))) return null;
    return MAI_NEXT.has(nextWord(text, end(m))) ? null : found(m, addDays(today, 1));
  }
  if ((m = at(D.nay, text, index))) {
    if (NAY_PREV.has(prevWord(text, index)) || NAY_NEXT.has(nextWord(text, end(m)))) return null;
    return found(m, today);
  }
  if ((m = at(D.mot, text, index))) {
    if (MOT_PREV.has(prevWord(text, index)) || MOT_NEXT.has(nextWord(text, end(m)))) return null;
    return found(m, addDays(today, 2));
  }
  return null;
}

// ---- times ----------------------------------------------------------------------------------------------------------

/** Hour shifted by a day part; null when they do not fit ("12h tối", "19h sáng"). */
function hourWithDayPart(hour: number, part: DayPart): number | null {
  switch (part) {
    case 'morning':
      return hour <= 12 ? hour : null;
    case 'noon':
      if (hour >= 1 && hour <= 3) return hour + 12;
      return hour >= 10 && hour <= 15 ? hour : null;
    case 'afternoon':
      if (hour >= 1 && hour <= 11) return hour + 12;
      return hour >= 12 ? hour : null;
    case 'evening':
      if (hour >= 1 && hour <= 11) return hour + 12;
      return hour >= 13 ? hour : null;
    case 'night':
      if (hour >= 8 && hour <= 11) return hour + 12;
      if (hour === 12) return 0;
      return hour <= 5 || hour >= 20 ? hour : null;
  }
}

function clockVi(hourText: string, minuteText: string | undefined, part: DayPart | undefined): string | null {
  let hour: number | null = Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  if (minute > 59 || hour > 23) return null;
  if (part) hour = hourWithDayPart(hour, part);
  return hour === null ? null : `${pad(hour)}:${pad(minute)}`;
}

/** "HH:mm" shifted by a day part given apart ("tối mai 8h" → 20:00); unchanged when they do not fit. */
export function withDayPart(time: string, part: DayPart): string {
  return clockVi(time.slice(0, 2), time.slice(3, 5), part) ?? time;
}

const HOUR_MARK = `(h|\\s?${w('giờ')})`;
const MINUTES = `(?:\\s?(\\d{1,2})\\s?(?:${w('phút')}|p)|\\s?(\\d{2})|\\s(${w('rưỡi')}))?`;
const RANGE_PART = `(\\d{1,2})(?:(h|\\s?${w('giờ')})(?:\\s?(\\d{2}))?|:(\\d{2}))?`;

const T = {
  range: sticky(
    `(?:${w('từ')}\\s+)?${RANGE_PART}(?:\\s?[-–]\\s?|\\s+(?:${w('đến')}|${w('tới')})\\s+)${RANGE_PART}(?:\\s+${DAY_PART})?${END}`,
  ),
  time: sticky(
    `(?:${VAO}(${w('lúc')})\\s+)?(\\d{1,2})(?:${HOUR_MARK}${MINUTES}|:(\\d{2}))?(?:\\s+${DAY_PART})?${END}`,
  ),
  dayPart: sticky(`${DAY_PART}${END}`),
  duration: sticky(
    `(?:(${w('trong')})\\s+)?(?:(\\d{1,2}(?:[.,]\\d)?)\\s?(${w('tiếng')}|${w('giờ')}|h)(?:\\s?(\\d{1,2})\\s?(?:${w('phút')}|p)|\\s(${w('rưỡi')}))?|(\\d{1,4})\\s?(?:${w('phút')}|p))${END}`,
  ),
};

/** One Vietnamese time ("7h30", "7 giờ tối", "lúc 7"), or a range "9-10h" = time + duration. */
export function matchTimeVi(text: string, index: number): Phrase | null {
  let m: RegExpExecArray | null;
  if ((m = at(T.range, text, index))) {
    const [, h1, mark1, m1, c1, h2, mark2, m2, c2, partRaw] = m;
    if (mark1 || mark2 || partRaw || c1 !== undefined || c2 !== undefined) {
      const part = partRaw ? dayPartOf(partRaw) : undefined;
      const endTime = clockVi(h2, m2 ?? c2, part);
      let startTime = clockVi(h1, m1 ?? c1, undefined);
      const shifted = part ? clockVi(h1, m1 ?? c1, part) : null;
      if (shifted && endTime && toMinutes(shifted) <= toMinutes(endTime)) startTime = shifted;
      if (startTime && endTime) {
        let duration = toMinutes(endTime) - toMinutes(startTime);
        if (duration <= 0) duration += 24 * 60;
        return { end: index + m[0].length, time: startTime, duration, fixed: Boolean(part) };
      }
    }
  }
  if ((m = at(T.time, text, index))) {
    const [, luc, hour, mark, unitMinutes, twoDigits, half, colon, partRaw] = m;
    if (!mark && !luc && !(colon !== undefined && partRaw)) return null;
    const minutes = unitMinutes ?? twoDigits ?? colon ?? (half ? '30' : undefined);
    const time = clockVi(hour, minutes, partRaw ? dayPartOf(partRaw) : undefined);
    return time ? { end: index + m[0].length, time, fixed: Boolean(partRaw) } : null;
  }
  return null;
}

/** A day part alone ("sáng" in "sáng mai"): only valid together with a date or a repeat (checked by the group). */
export function matchDayPartVi(text: string, index: number): Phrase | null {
  const m = at(T.dayPart, text, index);
  if (!m || DAY_PART_PREV.has(prevWord(text, index))) return null;
  // Unaccented "toi" leading a phrase is usually "tôi" (I): only "toi nay" counts.
  if (m[1] === 'toi' && nextWord(text, index + m[0].length) !== 'nay') return null;
  return { end: index + m[0].length, dayPart: dayPartOf(m[1]) };
}

/** "trong 1 tiếng", "1 tiếng 30 phút", "trong 45 phút" (bare "giờ" / "h" need "trong"). */
export function matchDurationVi(text: string, index: number): Phrase | null {
  const m = at(T.duration, text, index);
  if (!m) return null;
  const [, trong, amount, unit, extra, half, minutesOnly] = m;
  let minutes: number;
  if (minutesOnly !== undefined) {
    minutes = Number(minutesOnly);
  } else {
    if (!trong && ['gio', 'h'].includes(fold(unit))) return null;
    minutes = Math.round(Number(amount.replace(',', '.')) * 60) + Number(extra ?? 0) + (half ? 30 : 0);
  }
  return minutes >= 1 && minutes <= 24 * 60 ? { end: index + m[0].length, duration: minutes } : null;
}

// ---- repeats --------------------------------------------------------------------------------------------------------

const EACH = `(?:${w('mỗi')}|${w('hằng')}|${w('hàng')})`;
const OF_MONTH = `(?:\\s+(?:${w('của')}|${EACH}))?\\s+${w('tháng')}`;
const LAST_OF_MONTH = `${w('cuối')}(?:\\s+${w('cùng')})?${OF_MONTH}`;

const R = {
  head: sticky(`${EACH}(!)?\\s+`),
  lastWorkday: sticky(`${ph('ngày làm việc')}\\s+${LAST_OF_MONTH}${END}`),
  workdays: sticky(`${any('ngày làm việc', 'ngày trong tuần')}${END}`),
  lastDay: sticky(`(?:${w('ngày')}\\s+)?${LAST_OF_MONTH}${END}`),
  monthDay: sticky(
    `${w('tháng')}\\s+${VAO}${w('ngày')}\\s+(?:(\\d{1,2})|${w('cuối')}(?:\\s+${w('cùng')})?)${END}`,
  ),
  yearDay: sticky(`${w('năm')}\\s+${VAO}(?:${w('ngày')}\\s+)?(\\d{1,2})/(\\d{1,2})${END}`),
  weekOn: sticky(`${w('tuần')}\\s+${VAO}`),
  unit: sticky(`${UNIT}${END}`),
  dayPart: sticky(`${DAY_PART}${END}`),
  count: sticky(`(\\d{1,3})\\s+${UNIT}${END}`),
  weekday: sticky(`${WEEKDAY}${END}`),
  weekdayDigit: sticky(`([2-7])${END}`),
  weekdaySeparator: sticky(`\\s*,\\s*(?:${w('và')}\\s+)?|\\s+${w('và')}\\s+|\\s*&\\s*`),
  monthWeekday: sticky(`\\s+(${w('đầu')}(?:\\s+${w('tiên')})?|${w('cuối')}(?:\\s+${w('cùng')})?)${OF_MONTH}${END}`),
  // headless repeats (no "mỗi")
  other: sticky(`${w('cách')}\\s+${UNIT}${END}`),
  theWorkdays: sticky(`${w('các')}\\s+${any('ngày trong tuần', 'ngày làm việc')}${END}`),
  dayEachMonth: sticky(`${w('ngày')}\\s+(\\d{1,2})\\s+${EACH}\\s+${w('tháng')}${END}`),
  lastEachMonth: sticky(`(?:${w('ngày')}\\s+)?${w('cuối')}(?:\\s+${w('cùng')})?(?:\\s+${w('của')})?\\s+${EACH}\\s+${w('tháng')}${END}`),
  dateEachYear: sticky(`(?:${w('ngày')}\\s+)?(\\d{1,2})/(\\d{1,2})\\s+${EACH}\\s+${w('năm')}${END}`),
};

type Body = { end: number; spec: RecurrenceSpec; dayPart?: DayPart };

const validDay = (day: number) => day >= 1 && day <= 31;

/** Weekday list "thứ hai, thứ tư và thứ sáu" / "t2 và t5" / "thứ 2, 4, 6" (+ "cuối tháng" = monthly). */
function weekdayList(text: string, index: number, base: Omit<RecurrenceSpec, 'freq'>): Body | null {
  const first = at(R.weekday, text, index);
  if (!first) return null;
  let position = index + first[0].length;
  const monthly = at(R.monthWeekday, text, position);
  if (monthly) {
    const ordinal = fold(monthly[1]).startsWith('dau') ? 1 : -1;
    return {
      end: position + monthly[0].length,
      spec: { freq: 'MONTHLY', ...base, byDay: [{ weekday: weekdayCode(first[1]), ordinal }] },
    };
  }
  const days: Weekday[] = [weekdayCode(first[1])];
  let digits = /\d$/.test(first[1]) && isOrdinalForm(first[1]);
  for (;;) {
    const separator = at(R.weekdaySeparator, text, position);
    if (!separator) break;
    const from = position + separator[0].length;
    const next = at(R.weekday, text, from) ?? (digits ? at(R.weekdayDigit, text, from) : null);
    if (!next) break;
    const code = /^[2-7]$/.test(next[1]) ? RRULE_DAYS[Number(next[1]) - 2] : weekdayCode(next[1]);
    if (/^[2-7]$/.test(next[1]) || (isOrdinalForm(next[1]) && /\d$/.test(next[1]))) digits = true;
    if (!days.includes(code)) days.push(code);
    position = from + next[0].length;
  }
  return { end: position, spec: { freq: 'WEEKLY', ...base, byDay: days.map((weekday) => ({ weekday })) } };
}

function everyBody(text: string, index: number, fromCompletion: boolean): Body | null {
  const base = { interval: 1, fromCompletion };
  let m: RegExpExecArray | null;
  const end = (match: RegExpExecArray) => index + match[0].length;
  if ((m = at(R.lastWorkday, text, index))) {
    return { end: end(m), spec: { freq: 'MONTHLY', ...base, byDay: WORKDAYS.map((weekday) => ({ weekday })), bySetPos: -1 } };
  }
  if ((m = at(R.workdays, text, index))) {
    return { end: end(m), spec: { freq: 'WEEKLY', ...base, byDay: WORKDAYS.map((weekday) => ({ weekday })) } };
  }
  if ((m = at(R.lastDay, text, index))) return { end: end(m), spec: { freq: 'MONTHLY', ...base, byMonthDay: [-1] } };
  if ((m = at(R.monthDay, text, index))) {
    const day = m[1] === undefined ? -1 : Number(m[1]);
    return day === -1 || validDay(day) ? { end: end(m), spec: { freq: 'MONTHLY', ...base, byMonthDay: [day] } } : null;
  }
  if ((m = at(R.yearDay, text, index))) {
    const [day, month] = [Number(m[1]), Number(m[2])];
    if (!dateKey(2024, month, day)) return null;
    return { end: end(m), spec: { freq: 'YEARLY', ...base, byMonth: [month], byMonthDay: [day] } };
  }
  if ((m = at(R.weekOn, text, index))) {
    const list = weekdayList(text, end(m), base);
    if (list && list.spec.freq === 'WEEKLY') return list;
  }
  if ((m = at(R.unit, text, index))) return { end: end(m), spec: { freq: FREQ[fold(m[1])], ...base } };
  if ((m = at(R.dayPart, text, index))) {
    return { end: end(m), spec: { freq: 'DAILY', ...base }, dayPart: dayPartOf(m[1]) };
  }
  if ((m = at(R.count, text, index))) {
    const interval = Number(m[1]);
    return interval >= 1 ? { end: end(m), spec: { freq: FREQ[fold(m[2])], ...base, interval } } : null;
  }
  return weekdayList(text, index, base);
}

function headless(text: string, index: number): Body | null {
  const base = { interval: 1, fromCompletion: false };
  let m: RegExpExecArray | null;
  const end = (match: RegExpExecArray) => index + match[0].length;
  if ((m = at(R.other, text, index))) return { end: end(m), spec: { freq: FREQ[fold(m[1])], ...base, interval: 2 } };
  if ((m = at(R.theWorkdays, text, index))) {
    return { end: end(m), spec: { freq: 'WEEKLY', ...base, byDay: WORKDAYS.map((weekday) => ({ weekday })) } };
  }
  if ((m = at(R.dayEachMonth, text, index))) {
    const day = Number(m[1]);
    return validDay(day) ? { end: end(m), spec: { freq: 'MONTHLY', ...base, byMonthDay: [day] } } : null;
  }
  if ((m = at(R.lastEachMonth, text, index))) return { end: end(m), spec: { freq: 'MONTHLY', ...base, byMonthDay: [-1] } };
  if ((m = at(R.dateEachYear, text, index))) {
    const [day, month] = [Number(m[1]), Number(m[2])];
    if (!dateKey(2024, month, day)) return null;
    return { end: end(m), spec: { freq: 'YEARLY', ...base, byMonth: [month], byMonthDay: [day] } };
  }
  return null;
}

/** "mỗi …" / "hằng …" / "hàng …" ("mỗi! …" = from the completion date) and the repeats without them. */
export function matchEveryVi(text: string, index: number): Phrase | null {
  const head = at(R.head, text, index);
  const body = head ? everyBody(text, index + head[0].length, head[1] === '!') : headless(text, index);
  if (!body) return null;
  return { end: body.end, recurrence: { spec: body.spec }, ...(body.dayPart ? { dayPart: body.dayPart } : {}) };
}

const M = {
  starting: sticky(`(?:${ph('bắt đầu')}(?:\\s+(?:${w('từ')}|${w('vào')}))?|${w('từ')})\\s+`),
  until: sticky(`(?:${w('cho')}\\s+)?(?:${w('đến')}|${w('tới')})(?:\\s+${w('hết')})?\\s+`),
  forCount: sticky(`${w('trong')}\\s+(\\d{1,3})\\s+${UNIT}${END}`),
};

/**
 * "bắt đầu từ …" / "từ …", "đến …" / "cho tới …", "trong N tuần" after a repeat. `matchDate` = any date phrase
 * (Vietnamese or English: "từ nov 5" works too).
 */
export function matchRepeatModifierVi(
  text: string,
  index: number,
  matchDate: (text: string, index: number) => Phrase | null,
): Phrase | null {
  let m: RegExpExecArray | null;
  if ((m = at(M.starting, text, index))) {
    const date = matchDate(text, index + m[0].length);
    if (date?.date) return { end: date.end, recurrence: { spec: emptySpec(), startDate: date.date } };
  }
  if ((m = at(M.until, text, index))) {
    const date = matchDate(text, index + m[0].length);
    if (date?.date) return { end: date.end, recurrence: { spec: { ...emptySpec(), untilDate: date.date } } };
  }
  if ((m = at(M.forCount, text, index))) {
    const count = Number(m[1]);
    if (count > 0) {
      return { end: index + m[0].length, recurrence: { spec: emptySpec(), forCount: { count, unit: unitEn(m[2]) } } };
    }
  }
  return null;
}

// ---- reminders ------------------------------------------------------------------------------------------------------

const RELATIVE_REMINDER = sticky(
  `(\\d{1,4})\\s?(${w('phút')}|p|${w('tiếng')}|${w('giờ')}|h|${w('ngày')})(?:\\s?(\\d{1,2})\\s?(?:${w('phút')}|p))?\\s+${w('trước')}${END}`,
);

/** "30 phút trước", "1 tiếng 30 phút trước", "1 ngày trước" (after the "!"): minutes before the due. */
export function matchRelativeReminderVi(text: string, index: number): { end: number; minutes: number } | null {
  const m = at(RELATIVE_REMINDER, text, index);
  if (!m) return null;
  const amount = Number(m[1]);
  const unit = fold(m[2]);
  const factor = unit === 'ngay' ? 1440 : ['tieng', 'gio', 'h'].includes(unit) ? 60 : 1;
  return { end: index + m[0].length, minutes: amount * factor + Number(m[3] ?? 0) };
}
