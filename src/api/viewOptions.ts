import { apiFetch } from './client';

/** JSON enums are uppercase (spec 12 conventions); the task list query uses lowercase. */
export type SortBy = 'MANUAL' | 'DATE' | 'DEADLINE' | 'PRIORITY' | 'NAME' | 'ADDED';
export type SortDirection = 'ASC' | 'DESC';
/** M7 adds ADDED ("Added date": the account-zone day the task was created, newest day first). */
export type GroupBy = 'NONE' | 'DATE' | 'DEADLINE' | 'PRIORITY' | 'PROJECT' | 'LABEL' | 'ADDED';
export type DueFilter = 'TODAY' | 'THIS_WEEK' | 'NEXT_7_DAYS' | 'THIS_MONTH' | 'NEXT_30_DAYS' | 'NO_DATE' | 'OVERDUE';
/** M7 (contract 2): view_options.layout. */
export type Layout = 'LIST' | 'BOARD' | 'CALENDAR';

export type ViewKey = 'TODAY' | 'UPCOMING' | `project:${string}` | `label:${string}` | `filter:${string}`;

/** Body of PUT view-options/{viewKey}: unset optional fields are left out. */
export interface ViewOptionsBody {
  sortBy: SortBy;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  filterPriority?: number;
  filterLabelId?: string;
  filterDue?: DueFilter;
  /** Projects, Today and Upcoming (M7). */
  showCompleted?: boolean;
  /** M7: absent = the server keeps the saved layout. */
  layout?: Layout;
  /** M7: Upcoming only; absent = keep. */
  showFutureOccurrences?: boolean;
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
  /** M7: absent in answers of a server without M7 → read as LIST. */
  layout?: Layout;
  /** M7: Upcoming only (null elsewhere in the app model). */
  showFutureOccurrences?: boolean | null;
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
