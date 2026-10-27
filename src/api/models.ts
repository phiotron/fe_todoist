import type { components } from './types.gen';

/**
 * Generated-type aliases (Task 30). Every caller imports models from THIS file, never from types.gen.ts.
 * Hand-written here: Page<T>, PROJECT_COLORS, TaskView, TaskListParams (app-side constants / query params).
 */

type Schemas = components['schemas'];

/** springdoc may mark response fields optional; the M1 contract guarantees they are present (spec 7.2). */
type Strict<T> = { [K in keyof T]-?: Exclude<T[K], undefined> };

/**
 * springdoc does not emit `nullable` for optional request fields, but the contract uses `null` as "clear" / "first"
 * (spec 12 "vắng ≠ null"). Widen exactly those fields until the backend declares them nullable (review-notes Task 30).
 */
type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]?: T[P] | null };

export interface Page<T> {
  items: T[];
  /** null = last page. */
  nextCursor: string | null;
}

/** The 20 colour keys shared by projects, labels and filters (spec 10.1, default charcoal). */
export const PROJECT_COLORS = [
  'berry_red',
  'red',
  'orange',
  'yellow',
  'olive_green',
  'lime_green',
  'green',
  'mint_green',
  'teal',
  'sky_blue',
  'light_blue',
  'blue',
  'grape',
  'violet',
  'lavender',
  'magenta',
  'salmon',
  'charcoal',
  'grey',
  'taupe',
] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];
export const DEFAULT_PROJECT_COLOR: ProjectColor = 'charcoal';

export type Task = Strict<Schemas['TaskResponse']>;
export type Project = Strict<Schemas['ProjectResponse']>;
export type Section = Strict<Schemas['SectionResponse']>;
export type Favorite = Strict<Schemas['FavoriteResponse']>;
export type FavoriteTargetType = Favorite['targetType'];
export type TaskChangeResponse = Strict<Schemas['TaskChangeResponse']>;
export type CascadedTask = TaskChangeResponse['cascaded'][number];
export type ReorderResponse = Strict<Schemas['ReorderResponse']>;
export type AffectedTasksResponse = Strict<Schemas['AffectedTasksResponse']>;

export type TaskView = 'today' | 'upcoming' | 'overdue' | 'completed';

/**
 * One task list (spec 12.3): exactly one of `view` / `projectId`. `projectId` + `completed=true` = completed root tasks
 * of a project (Display → Completed tasks). `view=completed[&since&until]` = Completed screen of Browse (every
 * project, one row per task incl. subtasks, newest first; `since` / `until` yyyy-MM-dd in the account zone, both ends
 * included). `view=upcoming[&from][&to]` = a DAY WINDOW (default 14 days, max 31, at most 2 years ahead).
 * `from` / `to` only with upcoming, `since` / `until` only with completed (else the server answers 400).
 * M2 adds labelId / filter and the Display parameters.
 */
export interface TaskListParams {
  view?: TaskView;
  projectId?: string;
  completed?: boolean;
  from?: string;
  to?: string;
  since?: string;
  until?: string;
  /**
   * Client-only cache-key part (never sent): the account-zone "today" the list was built for, so a view that depends on
   * the day (Today) is a different query after midnight and refetches.
   */
  today?: string;
}

/**
 * POST tasks. `afterId` absent = end of the container, null = first (spec 12 "vắng ≠ null"); `parentId` / `sectionId`
 * absent or null = a root task / no section.
 */
export type CreateTaskRequest = Nullable<
  Schemas['CreateTaskRequest'],
  'sectionId' | 'parentId' | 'dueDate' | 'dueDatetime' | 'durationMinutes' | 'deadlineDate' | 'afterId'
>;
/**
 * PATCH tasks/{id}: the version the edit started from + changed fields only. Absent = keep, null = clear; sending
 * dueDate or dueDatetime replaces the whole due.
 */
export type UpdateTaskRequest = Nullable<
  Schemas['UpdateTaskRequest'],
  'dueDate' | 'dueDatetime' | 'durationMinutes' | 'deadlineDate'
>;
/** POST tasks/{id}/move: `sectionId` / `parentId` null or absent = none; `afterId` absent = end of the container, null = first. */
export type MoveTaskRequest = Nullable<Schemas['MoveTaskRequest'], 'sectionId' | 'parentId' | 'afterId'>;
export type TaskBatchRequest = Schemas['BatchTasksRequest'];
export type BatchAction = TaskBatchRequest['action'];
/** `parentId` null or absent = root project; `afterId` absent = last, null = first. */
export type CreateProjectRequest = Nullable<Schemas['CreateProjectRequest'], 'parentId'>;
export type UpdateProjectRequest = Schemas['UpdateProjectRequest'];
/** POST projects/{id}/move: `parentId` must be PRESENT (null = root); `afterId` absent = last, null = first. */
export type MoveProjectRequest = Schemas['MoveProjectRequest'];
/** `afterId` absent = last, null = first. */
export type CreateSectionRequest = Schemas['CreateSectionRequest'];
export type UpdateSectionRequest = Schemas['UpdateSectionRequest'];
/** `afterId` is REQUIRED (absent → 400): null = first in its container, else the id of the item right before it. Never changes `version`. */
export type ReorderRequest = Schemas['ReorderRequest'];
export type ReorderType = ReorderRequest['type'];

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
/** Compile-time guard (type only, no runtime code): fails to compile when the server's 20 colour keys drift from PROJECT_COLORS. */
export type ColorsInSync = Assert<Same<ProjectColor, NonNullable<Schemas['CreateProjectRequest']['color']>>>;
