import type { Label } from '../../api/labels';
import type { Task } from '../../api/models';
import type { GroupBy } from '../../api/viewOptions';
import i18n from '../../i18n';
import { dateKeyInZone } from '../../lib/dates';
import { formatDayHeader } from '../../lib/dates/format';
import { parseInstant } from '../../lib/dates/instant';
import { sectionRow, taskRows, treeRows, type TaskListRow } from '../tasks/taskRows';

export type GroupableTask = Pick<
  Task,
  'id' | 'parentId' | 'dueDate' | 'dueDatetime' | 'deadlineDate' | 'priority' | 'projectId' | 'projectName' | 'labelIds'
> &
  Partial<Pick<Task, 'createdAt'>>;

export interface GroupContext {
  /** yyyy-MM-dd of today in the account time zone (day titles: "Hôm nay", "Ngày mai"…). */
  todayKey: string;
  labels: ReadonlyMap<string, Label>;
  /** M7 "Added date": the account time zone that turns `createdAt` (an instant) into a day. Absent = UTC. */
  timeZone?: string;
  /** VIUI: name shown for a project group (the Inbox follows the app language). Absent = the server name. */
  projectName?: (projectId: string, projectName: string | null | undefined) => string;
}

/** M7: the account-zone day a task was created (group "Added date", spec 12.7 / plan M7 F2). */
export function addedDayOf(task: Partial<Pick<Task, 'createdAt'>>, timeZone = 'UTC'): string | null {
  return task.createdAt ? dateKeyInZone(parseInstant(task.createdAt), timeZone) : null;
}

export interface TaskGroup<T> {
  key: string;
  title: string;
  tasks: T[];
}

/** Day of a due: a date, or the first 10 characters of a floating "yyyy-MM-ddTHH:mm:ss" (spec 5.2). */
export function dueDayOf(task: Pick<Task, 'dueDate' | 'dueDatetime'>): string | null {
  return task.dueDate ?? (task.dueDatetime ? task.dueDatetime.slice(0, 10) : null);
}

/** Spec 12.7: grouping by label uses the task's first label in label sort order. */
export function firstLabelOf(task: Pick<Task, 'labelIds'>, labels: ReadonlyMap<string, Label>): Label | null {
  let first: Label | null = null;
  for (const id of task.labelIds ?? []) {
    const label = labels.get(id);
    if (label && (first === null || label.sortOrder < first.sortOrder)) first = label;
  }
  return first;
}

function groupKeyOf(task: GroupableTask, groupBy: GroupBy, ctx: GroupContext): { key: string; title: string } {
  switch (groupBy) {
    case 'DATE': {
      const day = dueDayOf(task);
      return day
        ? { key: `date:${day}`, title: formatDayHeader(day, ctx.todayKey) }
        : { key: 'date:none', title: i18n.t('display.groups.noDate') };
    }
    case 'DEADLINE': {
      const day = task.deadlineDate;
      return day
        ? { key: `deadline:${day}`, title: i18n.t('display.groups.deadline', { date: formatDayHeader(day, ctx.todayKey) }) }
        : { key: 'deadline:none', title: i18n.t('display.groups.noDeadline') };
    }
    case 'PRIORITY':
      return { key: `priority:${task.priority}`, title: i18n.t('display.groups.priority', { n: task.priority }) };
    case 'PROJECT':
      return {
        key: `project:${task.projectId}`,
        title: ctx.projectName ? ctx.projectName(task.projectId, task.projectName) : (task.projectName ?? ''),
      };
    case 'LABEL': {
      const label = firstLabelOf(task, ctx.labels);
      return label
        ? { key: `label:${label.id}`, title: label.name }
        : { key: 'label:none', title: i18n.t('display.groups.noLabel') };
    }
    case 'ADDED': {
      const day = addedDayOf(task, ctx.timeZone);
      return day
        ? { key: `added:${day}`, title: i18n.t('display.groups.added', { date: formatDayHeader(day, ctx.todayKey) }) }
        : { key: 'added:none', title: '' };
    }
    default:
      return { key: 'all', title: '' };
  }
}

/**
 * Splits a server-sorted list into runs of neighbours with the same group key (the server sorts by the group key
 * first, spec 12.7). In 'tree' mode (project view) only root tasks decide the group; subtasks follow their root.
 */
export function groupTasks<T extends GroupableTask>(
  tasks: readonly T[],
  groupBy: GroupBy,
  ctx: GroupContext,
  mode: 'flat' | 'tree' = 'flat',
): TaskGroup<T>[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const rootOf = (task: T): T => {
    if (mode === 'flat') return task;
    let current = task;
    const seen = new Set<string>([current.id]);
    while (current.parentId && byId.has(current.parentId) && !seen.has(current.parentId)) {
      current = byId.get(current.parentId) as T;
      seen.add(current.id);
    }
    return current;
  };

  const groups: TaskGroup<T>[] = [];
  const groupOfRoot = new Map<string, TaskGroup<T>>();
  for (const task of tasks) {
    const root = rootOf(task);
    let group = groupOfRoot.get(root.id);
    if (!group) {
      const { key, title } = groupKeyOf(root, groupBy, ctx);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        group = last;
      } else {
        group = { key, title, tasks: [] };
        groups.push(group);
      }
      groupOfRoot.set(root.id, group);
    }
    group.tasks.push(task);
  }
  return groups;
}

/** Rows for TaskListView: plain rows when not grouped, else one header row (unique key) before each group. */
export function displayRows(
  tasks: readonly Task[],
  groupBy: GroupBy,
  ctx: GroupContext,
  mode: 'flat' | 'tree' = 'flat',
): TaskListRow[] {
  const toRows = mode === 'tree' ? treeRows : taskRows;
  if (groupBy === 'NONE') return toRows(tasks);
  return groupTasks(tasks, groupBy, ctx, mode).flatMap((group, index) => [
    sectionRow(`group-${index}-${group.key}`, { title: group.title }),
    ...toRows(group.tasks),
  ]);
}
