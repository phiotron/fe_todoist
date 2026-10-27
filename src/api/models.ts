/**
 * M1 API models.
 * TEMPORARY: hand-written from spec section 12 (v3) until Task 30 runs `npm run gen:api`; after that the type
 * aliases below point at the generated schemas. Every caller imports models from THIS file, never from
 * types.gen.ts, so Task 30 only edits this file.
 */

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

export interface Task {
  id: string;
  projectId: string;
  sectionId: string | null;
  parentId: string | null;
  content: string;
  /** Always a string; '' when empty. */
  description: string;
  /** 1 = P1 (highest) … 4 = P4 (default). */
  priority: number;
  /** yyyy-MM-dd, all-day due. */
  dueDate: string | null;
  /** Floating local time "yyyy-MM-ddTHH:mm:ss" (no Z / offset), read in the account time zone (spec 5.2). */
  dueDatetime: string | null;
  /** 1–1440, only with dueDatetime. */
  durationMinutes: number | null;
  /** yyyy-MM-dd; never makes the task overdue (BR-04). */
  deadlineDate: string | null;
  dueString: string | null;
  isOverdue: boolean;
  completedAt: string | null;
  /** Direct subtasks (spec 5.4). */
  subtaskCount: number;
  completedSubtaskCount: number;
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  projectName: string;
  /** Content of the parent when this is a subtask, null for root tasks. */
  parentContent: string | null;
}

export interface Project {
  id: string;
  name: string;
  /** null only for the Inbox. */
  color: string | null;
  description: string;
  /** Sub-projects (max 3 levels); null = root. */
  parentId: string | null;
  isInbox: boolean;
  isFavorite: boolean;
  archivedAt: string | null;
  sortOrder: number;
  viewStyle: string;
  /** Open tasks (incl. subtasks) of this project only. */
  activeTaskCount: number;
  /** Sub-projects at every depth below this one, archived ones included (spec 10.1 / 12.2) — never re-summed on the client. */
  descendantProjectCount: number;
  /** Open tasks (incl. subtasks) of the descendant projects ONLY, not of this project (spec 10.1): the delete dialog shows `activeTaskCount + descendantActiveTaskCount`. */
  descendantActiveTaskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  projectId: string;
  name: string;
  description: string;
  sortOrder: number;
  archivedAt: string | null;
  /** Open tasks (incl. subtasks). */
  activeTaskCount: number;
  createdAt: string;
  updatedAt: string;
}

export type FavoriteTargetType = 'PROJECT' | 'LABEL' | 'FILTER';

/** GET favorites, oldest first (spec 12.2); M1 only has PROJECT. */
export interface Favorite {
  targetType: FavoriteTargetType;
  targetId: string;
  createdAt: string;
}

/** A task changed by the cascade of close / reopen (spec 12.3); `completedAt` null = reopened. Not the task itself. */
export interface CascadedTask {
  id: string;
  version: number;
  completedAt: string | null;
}

/** close / reopen: the task plus what the cascade changed (spec 3.1 — replaces `cascadedTaskIds`). */
export interface TaskChangeResponse {
  task: Task;
  cascaded: CascadedTask[];
}

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

export interface CreateTaskRequest {
  /** Client-generated UUID (spec 12.11). Optional: M1–M8 do not send it (M9 offline create does). */
  id?: string;
  /** Absent = Inbox. */
  projectId?: string;
  sectionId?: string | null;
  parentId?: string | null;
  content: string;
  description?: string;
  priority?: number;
  dueDate?: string | null;
  dueDatetime?: string | null;
  durationMinutes?: number | null;
  deadlineDate?: string | null;
  /** Absent = end of the container, null = first (spec 12 "Vắng ≠ null"). */
  afterId?: string | null;
}

/**
 * PATCH tasks/{id}: the version the edit started from + changed fields only.
 * Absent = keep, null = clear; sending dueDate or dueDatetime replaces the whole due.
 */
export interface UpdateTaskRequest {
  version: number;
  content?: string;
  description?: string;
  priority?: number;
  dueDate?: string | null;
  dueDatetime?: string | null;
  durationMinutes?: number | null;
  deadlineDate?: string | null;
}

export interface MoveTaskRequest {
  projectId: string;
  /** null / absent = no section. */
  sectionId?: string | null;
  parentId?: string | null;
  /** Absent = end of the container, null = first. */
  afterId?: string | null;
}

export type BatchAction = 'CLOSE' | 'REOPEN' | 'MOVE' | 'DELETE' | 'SCHEDULE' | 'PRIORITY';

/** POST tasks/batch (spec 12.5): all or nothing; extra fields only for their action. */
export interface TaskBatchRequest {
  action: BatchAction;
  taskIds: string[];
  /** REOPEN only: Undo after "complete" from multi-select. */
  undo?: boolean;
  /** MOVE only; sectionId absent = no section. */
  projectId?: string;
  sectionId?: string;
  /** SCHEDULE only: timed tasks keep their time; null = remove the due. */
  date?: string | null;
  /** PRIORITY only. */
  priority?: number;
}

export interface AffectedTasksResponse {
  affectedTaskIds: string[];
}

export interface CreateProjectRequest {
  /** Client-generated UUID (spec 12.11), optional — see CreateTaskRequest. */
  id?: string;
  name: string;
  color?: ProjectColor;
  description?: string;
  parentId?: string | null;
  afterId?: string | null;
}

export interface UpdateProjectRequest {
  name?: string;
  color?: ProjectColor;
  description?: string;
}

/** POST projects/{id}/move: `parentId` must be PRESENT (null = root); afterId absent = last, null = first. */
export interface MoveProjectRequest {
  parentId: string | null;
  afterId?: string | null;
}

export interface CreateSectionRequest {
  /** Client-generated UUID (spec 12.11), optional — see CreateTaskRequest. */
  id?: string;
  name: string;
  description?: string;
  afterId?: string | null;
}

export interface UpdateSectionRequest {
  name?: string;
  description?: string;
}

export type ReorderType = 'PROJECT' | 'SECTION' | 'TASK';

export interface ReorderRequest {
  type: ReorderType;
  id: string;
  /** REQUIRED (absent → 400): null = first in its container, else the id of the item right before it. Never changes `version`. */
  afterId: string | null;
}

export interface ReorderResponse {
  type: ReorderType;
  id: string;
  sortOrder: number;
}
