import type { DateSettings } from '../dates/settings';
import type { RecurrenceSpec } from '../recurrence/types';

/** What a highlighted part of the Quick Add text is (spec 3.2 M6b). Repeats are part of a `date` token. */
export type QuickAddTokenKind = 'date' | 'project' | 'section' | 'label' | 'priority' | 'reminder' | 'assignee' | 'deadline';

export interface QuickAddToken {
  kind: QuickAddTokenKind;
  /** Offsets in the original text: [start, end). */
  start: number;
  end: number;
  /** The text as typed, e.g. "tomorrow 9-10", "#Work". */
  text: string;
  /** `${kind}:${text lower-cased}` — what "dismiss" (tap / Backspace) remembers. */
  key: string;
}

export interface ParsedDue {
  /** yyyy-MM-dd */
  date: string;
  /** "HH:mm", null = all day. */
  time: string | null;
  /** Only with a time (spec 5.2). */
  durationMinutes: number | null;
}

/** Same shapes as the M4 reminder drafts, except an absolute one keeps its own date (null = the due day). */
export type ParsedReminder =
  | { type: 'RELATIVE'; minuteOffset: number }
  | { type: 'ABSOLUTE'; date: string | null; time: string };

export interface QuickAddParse {
  /** Name without the recognised parts, spaces collapsed. Keeps a leading "* " and +person (until M8b). */
  content: string;
  tokens: QuickAddToken[];
  projectName?: string;
  sectionName?: string;
  /** Label names (no prefix), first appearance order, no duplicates. */
  labels: string[];
  priority?: number;
  reminders: ParsedReminder[];
  /** +person — recognised only; assignees arrive with M8b. */
  assignee?: string;
  /** yyyy-MM-dd from {…}. */
  deadline?: string;
  due?: ParsedDue;
  /** every … (contract 8.1). The rule is NOT sent before M6c. */
  recurrence?: RecurrenceSpec;
  /** "starting <date>" of a repeat. */
  startDate?: string;
  /** Leading "* " (Todoist): a task without a checkbox. */
  uncompletable: boolean;
}

export interface ParseContext {
  /** yyyy-MM-dd in the account time zone; the parser never reads the clock. */
  today: string;
  dateSettings: DateSettings;
  /** How "30/10" is read. */
  dateFormat: 'DMY' | 'MDY';
  /** me/settings.smartDateRecognition: off = no dates, times or repeats in the name. */
  smartDate: boolean;
  /** Known project names; undefined = accept any single word after #. */
  projects?: readonly string[];
  /** Sections of the project the task goes to; undefined = accept any single word after /. */
  sections?: readonly string[];
  /** Token keys the user dismissed. */
  ignored?: ReadonlySet<string>;
}
