import { combineDue } from '../../lib/dates';
import type { QuickAddParse } from '../../lib/quickadd';
import type { RecurrenceSpec } from '../../lib/recurrence/types';
import type { ReminderDraft } from '../../lib/reminders';
import type { DueValue } from '../schedule/dueValue';

/** What the user picked with the chips (the parsed text wins over it while a token is recognised). */
export interface ManualChoice {
  projectId?: string;
  sectionId: string | null;
  due: DueValue;
  priority: number;
  labelIds: string[];
  deadline: string | null;
}

interface Named {
  id: string;
  name: string;
}

export interface QuickAddLookups {
  projects: readonly Named[];
  /** Sections of the project the task goes to. */
  sections: readonly Named[];
  labels: readonly Named[];
  /** yyyy-MM-dd: the day of an absolute reminder typed without a date and without a due. */
  today: string;
}

export interface ResolvedQuickAdd {
  content: string;
  projectId?: string;
  sectionId: string | null;
  due: DueValue;
  priority: number;
  /** Existing labels (picked + typed). */
  labelIds: string[];
  /** Typed %labels that do not exist yet: created before the task (Todoist creates them too). */
  newLabelNames: string[];
  deadline: string | null;
  /** Reminders typed with "!" (the chip's drafts are added by the caller). */
  reminders: ReminderDraft[];
  recurrence?: RecurrenceSpec;
  uncompletable: boolean;
}

const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** The id of the project named by #project, if any (needed first to know which sections / to look in). */
export function parsedProjectId(parse: QuickAddParse, projects: readonly Named[]): string | undefined {
  return parse.projectName ? projects.find((project) => sameName(project.name, parse.projectName!))?.id : undefined;
}

export function resolveQuickAdd(parse: QuickAddParse, manual: ManualChoice, lookups: QuickAddLookups): ResolvedQuickAdd {
  const typedProject = parsedProjectId(parse, lookups.projects);
  const projectId = typedProject ?? manual.projectId;
  let sectionId = manual.sectionId;
  if (parse.sectionName) {
    sectionId = lookups.sections.find((section) => sameName(section.name, parse.sectionName!))?.id ?? null;
  } else if (typedProject && typedProject !== manual.projectId) {
    sectionId = null;
  }

  const due: DueValue = parse.due
    ? {
        ...combineDue(parse.due.date, parse.due.time),
        durationMinutes: parse.due.time ? parse.due.durationMinutes : null,
      }
    : manual.due;

  const labelIds = [...manual.labelIds];
  const newLabelNames: string[] = [];
  for (const name of parse.labels) {
    const existing = lookups.labels.find((label) => sameName(label.name, name));
    if (existing) {
      if (!labelIds.includes(existing.id)) labelIds.push(existing.id);
    } else if (!newLabelNames.some((other) => sameName(other, name))) {
      newLabelNames.push(name);
    }
  }

  const dueDay = due.dueDate ?? due.dueDatetime?.slice(0, 10) ?? lookups.today;
  const reminders: ReminderDraft[] = parse.reminders.map((reminder) =>
    reminder.type === 'RELATIVE'
      ? { type: 'RELATIVE', minuteOffset: reminder.minuteOffset }
      : { type: 'ABSOLUTE', at: `${reminder.date ?? dueDay}T${reminder.time}` },
  );

  return {
    content: parse.content,
    projectId,
    sectionId,
    due,
    priority: parse.priority ?? manual.priority,
    labelIds,
    newLabelNames,
    deadline: parse.deadline ?? manual.deadline,
    reminders,
    recurrence: parse.recurrence,
    uncompletable: parse.uncompletable,
  };
}
