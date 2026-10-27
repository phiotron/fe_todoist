import type { ComponentProps, ReactNode } from 'react';
import type { Task } from '../../api/models';
import type { SectionHeader } from '../../components/SectionHeader';
import { flattenTree } from '../subtasks/tree';

export type SectionRowProps = Omit<ComponentProps<typeof SectionHeader>, 'testID'>;

export type TaskListRow =
  | { type: 'section'; key: string; props: SectionRowProps }
  | { type: 'task'; key: string; task: Task; depth: number }
  | { type: 'node'; key: string; node: ReactNode };

export function sectionRow(key: string, props: SectionRowProps): TaskListRow {
  return { type: 'section', key, props };
}

export function nodeRow(key: string, node: ReactNode): TaskListRow {
  return { type: 'node', key, node };
}

/** One row per task, no indentation (Today, Upcoming: subtasks appear as their own tasks). */
export function taskRows(tasks: readonly Task[]): TaskListRow[] {
  return tasks.map((task): TaskListRow => ({ type: 'task', key: task.id, task, depth: 1 }));
}

/** Subtasks indented under their parent (Inbox, project, completed tasks). */
export function treeRows(tasks: readonly Task[]): TaskListRow[] {
  return flattenTree(tasks).map(({ task, depth }): TaskListRow => ({ type: 'task', key: task.id, task, depth }));
}
