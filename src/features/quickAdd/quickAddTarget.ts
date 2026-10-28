import { router } from 'expo-router';

/** Route params of the quick-add sheet (strings in the URL, all optional). */
export interface QuickAddParams {
  /** Absent = the Inbox. */
  projectId?: string;
  sectionId?: string;
  /** Adding a sub-task: projectId / sectionId are the parent's. */
  parentId?: string;
  /** yyyy-MM-dd preset for the date chip. */
  dueDate?: string;
  /** M12: text already in the name / description fields (shared text, widget). */
  content?: string;
  description?: string;
}

export interface QuickAddContext {
  /** "Today" in the account time zone, yyyy-MM-dd. */
  today: string;
  /** Day selected in the Upcoming week strip. */
  upcomingDay?: string;
  projectId?: string;
  sectionId?: string;
}

/** Spec 9.2: what the + button preselects on each screen. M2 adds `label` / `filter`. */
export function quickAddTargetFor(route: string, ctx: QuickAddContext): QuickAddParams {
  switch (route) {
    case 'today':
      return { dueDate: ctx.today };
    case 'upcoming':
      return { dueDate: ctx.upcomingDay ?? ctx.today };
    case 'project':
      return ctx.projectId ? { projectId: ctx.projectId, ...(ctx.sectionId ? { sectionId: ctx.sectionId } : {}) } : {};
    default:
      // inbox, browse and unknown routes: the Inbox.
      return {};
  }
}

function definedOnly(params: QuickAddParams): Record<string, string> {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) as Record<string, string>;
}

/** Opens the quick-add sheet (route `quick-add`, Task 29). */
export function openQuickAdd(params: QuickAddParams = {}): void {
  router.push({ pathname: '/quick-add', params: definedOnly(params) });
}

/** Route params (string | string[] | undefined) → QuickAddParams. */
export function parseQuickAddParams(raw: Record<string, string | string[] | undefined>): QuickAddParams {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const result: QuickAddParams = {};
  for (const key of ['projectId', 'sectionId', 'parentId', 'dueDate', 'content', 'description'] as const) {
    const value = first(raw[key]);
    if (value) result[key] = value;
  }
  return result;
}
