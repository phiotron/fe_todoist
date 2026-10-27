import { apiFetch } from './client';

/** JSON enums are uppercase (spec 12 conventions); the task list query uses lowercase. */
export type SortBy = 'MANUAL' | 'DATE' | 'DEADLINE' | 'PRIORITY' | 'NAME' | 'ADDED';
export type SortDirection = 'ASC' | 'DESC';
export type GroupBy = 'NONE' | 'DATE' | 'DEADLINE' | 'PRIORITY' | 'PROJECT' | 'LABEL';
export type DueFilter = 'TODAY' | 'THIS_WEEK' | 'NEXT_7_DAYS' | 'THIS_MONTH' | 'NEXT_30_DAYS' | 'NO_DATE' | 'OVERDUE';

export type ViewKey = 'TODAY' | 'UPCOMING' | `project:${string}` | `label:${string}` | `filter:${string}`;

/** Body of PUT view-options/{viewKey}: unset optional fields are left out. */
export interface ViewOptionsBody {
  sortBy: SortBy;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  filterPriority?: number;
  filterLabelId?: string;
  filterDue?: DueFilter;
  /** Project views only. */
  showCompleted?: boolean;
}

/** One saved Display (GET view-options); unset optional fields come back null. */
export interface ViewOptions {
  viewKey: string;
  sortBy: SortBy;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  filterPriority: number | null;
  filterLabelId: string | null;
  filterDue: DueFilter | null;
  showCompleted: boolean | null;
}

/** The ':' of "project:<uuid>" stays literal (allowed in a path segment); each side is encoded. */
export function viewOptionsPath(viewKey: ViewKey): string {
  return `/api/v1/view-options/${viewKey.split(':').map(encodeURIComponent).join(':')}`;
}

export const viewOptionsApi = {
  list: () => apiFetch<ViewOptions[]>('/api/v1/view-options'),
  save: (viewKey: ViewKey, body: ViewOptionsBody) =>
    apiFetch<ViewOptions>(viewOptionsPath(viewKey), { method: 'PUT', body }),
  reset: (viewKey: ViewKey) => apiFetch<void>(viewOptionsPath(viewKey), { method: 'DELETE' }),
};
