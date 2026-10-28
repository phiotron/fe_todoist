import type { Section, Task, TaskBatchRequest } from '../../api/models';
import type { GroupBy } from '../../api/viewOptions';
import i18n from '../../i18n';
import { groupTodayView } from '../../lib/dates';
import { formatDayHeader } from '../../lib/dates/format';
import { groupTasks, type GroupContext } from '../display/groupTasks';
import type { QuickAddParams } from '../quickAdd/quickAddTarget';

/**
 * M7 Board (plan M7 F3). Pure: the columns of each view and what a drop on a column does. A column without `drop`
 * does not take drops (Project / Label / Deadline / Added date groups, Overdue, "No date"): Todoist's rule is not known
 * there [CXM], and a move by label / deadline would be ambiguous.
 */
export type ColumnDrop =
  | { kind: 'section'; projectId: string; sectionId: string | null }
  | { kind: 'date'; date: string }
  | { kind: 'priority'; priority: number };

export interface BoardColumn {
  key: string;
  title: string;
  tasks: Task[];
  drop: ColumnDrop | null;
  /** "+ Add task" at the bottom of the column (Quick Add preset), absent = none. */
  add?: QuickAddParams;
  tone?: 'danger';
}

/** Sub-tasks and completed tasks stay where they are (spec 3.2: task con khÃ´ng kÃ©o Ä‘Æ°á»£c). */
export function isDraggable(task: Pick<Task, 'parentId' | 'completedAt'>, readOnly = false): boolean {
  return !readOnly && task.parentId === null && task.completedAt === null;
}

/** What a group key of groupTasks means as a drop target: a day, a priority, or nothing. */
export function dropForGroupKey(key: string): ColumnDrop | null {
  const date = /^date:(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (date) return { kind: 'date', date: date[1] };
  const priority = /^priority:([1-4])$/.exec(key);
  if (priority) return { kind: 'priority', priority: Number(priority[1]) };
  return null;
}

function groupedColumns(tasks: readonly Task[], groupBy: GroupBy, ctx: GroupContext): BoardColumn[] {
  return groupTasks(tasks, groupBy, ctx, 'flat').map((group) => ({
    key: group.key,
    title: group.title,
    tasks: group.tasks,
    drop: dropForGroupKey(group.key),
  }));
}

/**
 * Project / Inbox: Grouping None â†’ "No Section" then the active sections in order, root tasks only (a card shows its
 * sub-task count); other groupings â†’ one column per group (root tasks), as in the List.
 */
export function projectBoardColumns(
  tasks: readonly Task[],
  sections: readonly Section[],
  projectId: string,
  groupBy: GroupBy,
  ctx: GroupContext,
  readOnly = false,
): BoardColumn[] {
  const roots = tasks.filter((task) => task.parentId === null && task.completedAt === null);
  if (groupBy !== 'NONE') return groupedColumns(roots, groupBy, ctx);
  const known = new Set(sections.map((section) => section.id));
  const ordered = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const column = (section: Section | null): BoardColumn => {
    const sectionId = section?.id ?? null;
    return {
      key: `section:${sectionId ?? 'none'}`,
      title: section ? section.name : i18n.t('board.noSection'),
      tasks: roots.filter((task) =>
        sectionId === null ? !task.sectionId || !known.has(task.sectionId) : task.sectionId === sectionId,
      ),
      drop: readOnly ? null : { kind: 'section', projectId, sectionId },
      add: readOnly ? undefined : { projectId, ...(sectionId ? { sectionId } : {}) },
    };
  };
  return [column(null), ...ordered.map(column)];
}

/** Today: Grouping None â†’ "Overdue" (no drops) + today's column (drop = schedule today); else one column per group. */
export function todayBoardColumns(
  tasks: readonly Task[],
  now: Date,
  timeZone: string,
  today: string,
  groupBy: GroupBy,
  ctx: GroupContext,
): BoardColumn[] {
  if (groupBy !== 'NONE') return groupedColumns(tasks, groupBy, ctx);
  const blocks = groupTodayView(tasks, now, timeZone);
  const columns: BoardColumn[] = [];
  if (blocks.overdue.length > 0) {
    columns.push({ key: 'overdue', title: i18n.t('board.overdue'), tasks: blocks.overdue, drop: null, tone: 'danger' });
  }
  columns.push({
    key: `date:${today}`,
    title: formatDayHeader(today, today),
    tasks: blocks.today,
    drop: { kind: 'date', date: today },
    add: { dueDate: today },
  });
  return columns;
}

/** Upcoming: one column per day (empty days too), drop = schedule that day. */
export function dayBoardColumns(days: readonly string[], tasksByDay: ReadonlyMap<string, Task[]>, today: string): BoardColumn[] {
  return days.map((day) => ({
    key: `date:${day}`,
    title: formatDayHeader(day, today),
    tasks: tasksByDay.get(day) ?? [],
    drop: { kind: 'date', date: day },
    add: { dueDate: day },
  }));
}

/** Label / filter: Grouping None â†’ one column; else one column per group. */
export function listBoardColumns(tasks: readonly Task[], groupBy: GroupBy, ctx: GroupContext, title = ''): BoardColumn[] {
  if (groupBy !== 'NONE') return groupedColumns(tasks, groupBy, ctx);
  return [{ key: 'all', title, tasks: [...tasks], drop: null }];
}

/**
 * The batch request of a drop (spec 12.5, always one request), or null when nothing would change: tasks already in
 * that column are left out; none left â†’ null.
 */
export function planColumnDrop(column: BoardColumn, taskIds: readonly string[]): TaskBatchRequest | null {
  const drop = column.drop;
  if (!drop) return null;
  const inColumn = new Set(column.tasks.map((task) => task.id));
  const ids = taskIds.filter((id) => !inColumn.has(id));
  if (ids.length === 0) return null;
  switch (drop.kind) {
    case 'section':
      return drop.sectionId
        ? { action: 'MOVE', taskIds: ids, projectId: drop.projectId, sectionId: drop.sectionId }
        : { action: 'MOVE', taskIds: ids, projectId: drop.projectId };
    case 'date':
      return { action: 'SCHEDULE', taskIds: ids, date: drop.date };
    default:
      return { action: 'PRIORITY', taskIds: ids, priority: drop.priority };
  }
}
