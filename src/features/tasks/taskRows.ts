import type { ComponentProps, ReactNode } from 'react';
import type { Task } from '../../api/models';
import type { SectionHeader } from '../../components/SectionHeader';
import { flattenTree } from '../subtasks/tree';

export type SectionRowProps = Omit<ComponentProps<typeof SectionHeader>, 'testID'>;

/**
 * `drop` (DND in lists): the container key of the block this row belongs to — a header with it is a drop target for
 * the top of that block, a node with it (the "Add task" row) for its end. Without it the row takes no drops.
 */
export type TaskListRow =
  | { type: 'section'; key: string; props: SectionRowProps; drop?: string }
  | { type: 'task'; key: string; task: Task; depth: number }
  | { type: 'node'; key: string; node: ReactNode; drop?: string };

export function sectionRow(key: string, props: SectionRowProps, drop?: string): TaskListRow {
  return drop === undefined ? { type: 'section', key, props } : { type: 'section', key, props, drop };
}

export function nodeRow(key: string, node: ReactNode, drop?: string): TaskListRow {
  return drop === undefined ? { type: 'node', key, node } : { type: 'node', key, node, drop };
}

/** One row per task, no indentation (Today, Upcoming: subtasks appear as their own tasks). */
export function taskRows(tasks: readonly Task[]): TaskListRow[] {
  return tasks.map((task): TaskListRow => ({ type: 'task', key: task.id, task, depth: 1 }));
}

/** Subtasks indented under their parent (Inbox, project, completed tasks). */
export function treeRows(tasks: readonly Task[]): TaskListRow[] {
  return flattenTree(tasks).map(({ task, depth }): TaskListRow => ({ type: 'task', key: task.id, task, depth }));
}
