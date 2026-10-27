import type {
  AffectedTasksResponse,
  CascadedTask,
  Favorite,
  Page,
  Project,
  ReorderResponse,
  ReorderType,
  Section,
  Task,
  TaskChangeResponse,
} from '../api/models';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;
const CREATED = '2026-10-20T00:00:00Z';

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: nextId('t'),
    projectId: 'p-inbox',
    sectionId: null,
    parentId: null,
    content: 'Task',
    description: '',
    priority: 4,
    dueDate: null,
    dueDatetime: null,
    durationMinutes: null,
    deadlineDate: null,
    dueString: null,
    isOverdue: false,
    completedAt: null,
    subtaskCount: 0,
    completedSubtaskCount: 0,
    sortOrder: 1024,
    version: 0,
    createdAt: CREATED,
    updatedAt: CREATED,
    projectName: 'Inbox',
    parentContent: null,
    labelIds: [],
    ...overrides,
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: nextId('p'),
    name: 'Project',
    color: 'charcoal',
    description: '',
    parentId: null,
    isInbox: false,
    isFavorite: false,
    archivedAt: null,
    sortOrder: 1024,
    viewStyle: 'LIST',
    activeTaskCount: 0,
    descendantProjectCount: 0,
    descendantActiveTaskCount: 0,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

export const inboxProject: Project = makeProject({
  id: 'p-inbox',
  name: 'Inbox',
  color: null,
  isInbox: true,
  sortOrder: 0,
});

export function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: nextId('s'),
    projectId: 'p-1',
    name: 'Section',
    description: '',
    sortOrder: 1024,
    archivedAt: null,
    activeTaskCount: 0,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

export function makeFavorite(targetId: string, createdAt = CREATED): Favorite {
  return { targetType: 'PROJECT', targetId, createdAt };
}

export function page<T>(items: T[], nextCursor: string | null = null): Page<T> {
  return { items, nextCursor };
}

/** close / reopen answer (spec 3.1): the task + what the cascade changed. */
export function taskChange(task: Task, cascaded: CascadedTask[] = []): TaskChangeResponse {
  return { task, cascaded };
}

export function reorderResult(type: ReorderType, id: string, sortOrder = 1024): ReorderResponse {
  return { type, id, sortOrder };
}

/** tasks/batch and tasks/overdue/reschedule answer. */
export function affected(ids: string[]): AffectedTasksResponse {
  return { affectedTaskIds: ids };
}
