import { firstOccurrence } from './firstOccurrence';
import { matchGroup, matchTime, resolveRepeat } from './grammar';
import { matchRelativeReminderVi } from './grammar.vi';
import type { ParseContext, ParsedReminder, QuickAddParse, QuickAddToken, QuickAddTokenKind } from './types';

/** Characters a label name cannot contain (M2 LabelNames: whitespace @ % # / , ( ) | & ! \ *). */
const LABEL_NAME = /[^\s@%#/,()|&!\\*]{1,60}/y;
const PRIORITY = /p([1-4])(?=$|[\s,.;:!?)])/y;
const RELATIVE_REMINDER =
  /(\d{1,4})\s?(minutes|minute|mins|min|m|hours|hour|hrs|hr|h|days|day|d)\s+before(?=$|[\s,.;:!?)])/y;
const WORD_END = /^$|^[\s,.;:!?)]/;

const isSpace = (char: string | undefined) => char !== undefined && /\s/.test(char);

interface Candidate {
  kind: QuickAddTokenKind;
  end: number;
  apply: (result: QuickAddParse) => void;
}

/**
 * Quick Add parser (spec 3.2 M6b, Todoist syntax). Dates, times, repeats and reminders are recognised in English AND
 * Vietnamese side by side, no setting (VIQA — supersedes "English only" of ADR 0006). Pure: `ctx.today` instead of
 * the clock.
 * A token starts a word (start of text or after a space). Single-value kinds (date, project, section, priority,
 * deadline, assignee) are recognised once — later ones stay text; labels and reminders add up.
 */
export function parseQuickAdd(text: string, ctx: ParseContext): QuickAddParse {
  const lower = text.toLowerCase();
  const ignored = ctx.ignored ?? new Set<string>();
  const result: QuickAddParse = { content: '', tokens: [], labels: [], reminders: [], uncompletable: false };
  const done = new Set<QuickAddTokenKind>();
  let index = 0;
  if (text.startsWith('* ')) {
    result.uncompletable = true;
    index = 2;
  }

  while (index < text.length) {
    if (isSpace(text[index])) {
      index += 1;
      continue;
    }
    const candidate = tokenAt(text, lower, index, ctx, done);
    if (candidate) {
      const tokenText = text.slice(index, candidate.end);
      const key = `${candidate.kind}:${tokenText.toLowerCase()}`;
      if (!ignored.has(key)) {
        result.tokens.push({ kind: candidate.kind, start: index, end: candidate.end, text: tokenText, key });
        candidate.apply(result);
        if (candidate.kind !== 'label' && candidate.kind !== 'reminder') done.add(candidate.kind);
      }
      index = candidate.end;
      continue;
    }
    while (index < text.length && !isSpace(text[index])) index += 1;
  }

  result.content = stripTokens(text, result.tokens);
  return result;
}

function tokenAt(
  text: string,
  lower: string,
  index: number,
  ctx: ParseContext,
  done: ReadonlySet<QuickAddTokenKind>,
): Candidate | null {
  const char = text[index];
  if (char === '#' && !done.has('project')) {
    const match = matchName(text, lower, index + 1, ctx.projects);
    return match ? { kind: 'project', end: match.end, apply: (r) => (r.projectName = match.name) } : null;
  }
  if (char === '/' && !done.has('section')) {
    const match = matchName(text, lower, index + 1, ctx.sections);
    return match ? { kind: 'section', end: match.end, apply: (r) => (r.sectionName = match.name) } : null;
  }
  if (char === '%' || char === '@') {
    LABEL_NAME.lastIndex = index + 1;
    const match = LABEL_NAME.exec(text);
    if (!match || !WORD_END.test(text.slice(index + 1 + match[0].length, index + 2 + match[0].length))) return null;
    const name = match[0];
    return {
      kind: 'label',
      end: index + 1 + name.length,
      apply: (r) => {
        if (!r.labels.some((label) => label.toLowerCase() === name.toLowerCase())) r.labels.push(name);
      },
    };
  }
  if (char === '+' && !done.has('assignee')) {
    const match = /\S+/y;
    match.lastIndex = index + 1;
    const found = match.exec(text);
    return found ? { kind: 'assignee', end: index + 1 + found[0].length, apply: (r) => (r.assignee = found[0]) } : null;
  }
  if (char === '!') return reminderAt(text, lower, index, ctx);
  if (char === '{' && !done.has('deadline')) return deadlineAt(text, lower, index, ctx);
  if ((char === 'p' || char === 'P') && !done.has('priority')) {
    PRIORITY.lastIndex = index;
    const match = PRIORITY.exec(lower);
    if (match) return { kind: 'priority', end: index + 2, apply: (r) => (r.priority = Number(match[1])) };
  }
  if (ctx.smartDate && !done.has('date')) {
    const group = matchGroup(lower, index, ctx, { repeats: true, times: true, source: text });
    if (group) {
      return {
        kind: 'date',
        end: group.end,
        apply: (r) => {
          let date = group.date;
          if (group.recurrence) {
            const repeat = resolveRepeat(group.recurrence, ctx.today);
            r.recurrence = repeat.spec;
            if (repeat.startDate) r.startDate = repeat.startDate;
            date = firstOccurrence(repeat.spec, repeat.startDate ?? ctx.today);
          }
          r.due = {
            date: date ?? ctx.today,
            time: group.time ?? null,
            durationMinutes: group.time ? (group.duration ?? null) : null,
          };
        },
      };
    }
  }
  return null;
}

/** Longest known name (case-insensitive) right after the prefix; any single word when no list is given. */
function matchName(text: string, lower: string, start: number, names: readonly string[] | undefined) {
  if (names === undefined) {
    const word = /\S+/y;
    word.lastIndex = start;
    const found = word.exec(text);
    return found ? { name: found[0], end: start + found[0].length } : null;
  }
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (!name || !lower.startsWith(name.toLowerCase(), start)) continue;
    const end = start + name.length;
    if (WORD_END.test(text.slice(end, end + 1))) return { name, end };
  }
  return null;
}

function reminderAt(text: string, lower: string, index: number, ctx: ParseContext): Candidate | null {
  RELATIVE_REMINDER.lastIndex = index + 1;
  const relative = RELATIVE_REMINDER.exec(lower);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const minutes = unit.startsWith('d') ? amount * 1440 : unit.startsWith('h') ? amount * 60 : amount;
    const reminder: ParsedReminder = { type: 'RELATIVE', minuteOffset: minutes };
    return { kind: 'reminder', end: index + 1 + relative[0].length, apply: (r) => r.reminders.push(reminder) };
  }
  // Vietnamese: "!30 phút trước", "!1 tiếng trước".
  const relativeVi = matchRelativeReminderVi(lower, index + 1);
  if (relativeVi) {
    const reminder: ParsedReminder = { type: 'RELATIVE', minuteOffset: relativeVi.minutes };
    return { kind: 'reminder', end: relativeVi.end, apply: (r) => r.reminders.push(reminder) };
  }
  // Absolute: "!5pm", "!at 17:00", "!nov 5 at 9am", "!mai 9h" — a time is required.
  const group = matchGroup(lower, index + 1, { ...ctx, smartDate: true }, { repeats: false, times: true, source: text });
  const time = group?.time ?? matchTime(lower, index + 1)?.time;
  if (!group || !time) return null;
  const reminder: ParsedReminder = { type: 'ABSOLUTE', date: group.date ?? null, time };
  return { kind: 'reminder', end: group.end, apply: (r) => r.reminders.push(reminder) };
}

function deadlineAt(text: string, lower: string, index: number, ctx: ParseContext): Candidate | null {
  const close = lower.indexOf('}', index + 1);
  if (close < 0 || !WORD_END.test(lower.slice(close + 1, close + 2))) return null;
  const inner = lower.slice(index + 1, close).trim();
  const source = text.slice(index + 1, close).trim();
  const group = matchGroup(inner, 0, ctx, { repeats: false, times: false, source });
  if (!group?.date || group.end !== inner.length) return null;
  const date = group.date;
  return { kind: 'deadline', end: close + 1, apply: (r) => (r.deadline = date) };
}

/** The name without recognised parts (+person stays until M8b), spaces collapsed. */
function stripTokens(text: string, tokens: readonly QuickAddToken[]): string {
  let content = '';
  let cursor = 0;
  for (const token of tokens) {
    if (token.kind === 'assignee') continue;
    content += `${text.slice(cursor, token.start)} `;
    cursor = token.end;
  }
  content += text.slice(cursor);
  const leading = content.startsWith('* ') ? '* ' : '';
  return (leading + content.slice(leading.length).replace(/\s+/g, ' ').trim()).trimEnd();
}
