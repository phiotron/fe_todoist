import type {
  DisplayDueParam,
  DisplayGroupParam,
  DisplayParams,
  DisplaySortParam,
} from '../../api/models';
import type { DueFilter, GroupBy, Layout, SortBy, ViewKey, ViewOptions, ViewOptionsBody } from '../../api/viewOptions';

export type ViewKind = 'today' | 'upcoming' | 'project' | 'label' | 'filter';

/** M7: every view offers the three layouts (contract 2), List first (the default). */
export const LAYOUTS: readonly Layout[] = ['LIST', 'BOARD', 'CALENDAR'];

/**
 * M7: the "Future occurrences" switch of Upcoming only makes sense with recurring tasks (M6c). Until M6c is merged the
 * switch stays hidden; the saved value is still kept and sent back.
 */
export const FUTURE_OCCURRENCES_ENABLED = true;

export const DUE_FILTERS: readonly DueFilter[] = [
  'TODAY',
  'THIS_WEEK',
  'NEXT_7_DAYS',
  'THIS_MONTH',
  'NEXT_30_DAYS',
  'NO_DATE',
  'OVERDUE',
];

export interface ViewRule {
  /** Allowed sort keys, the default first (spec 12.7 table). */
  sorts: readonly SortBy[];
  /** Allowed groupings, NONE (the default) first. */
  groups: readonly GroupBy[];
  /** "Completed tasks" switch: projects (M2), Today and Upcoming (M7, as Todoist); not labels / filters. */
  hasCompleted: boolean;
  /** M7: "Future occurrences" switch (Upcoming only). */
  hasFutureOccurrences: boolean;
  /**
   * Due filters the server accepts for this view (spec 12.7 / 12.10): Today has no "no date" (every Today task has a
   * due), Upcoming has neither "no date" nor "overdue" (always empty) — the server answers 400 for them.
   */
  dueFilters: readonly DueFilter[];
}

const LIST_RULE: ViewRule = {
  sorts: ['DATE', 'DEADLINE', 'PRIORITY', 'NAME', 'ADDED'],
  groups: ['NONE', 'DATE', 'DEADLINE', 'PRIORITY', 'PROJECT', 'LABEL', 'ADDED'],
  hasCompleted: false,
  hasFutureOccurrences: false,
  dueFilters: DUE_FILTERS,
};

// M7: "Added date" grouping (appended) everywhere but Upcoming (always by day).
export const VIEW_RULES: Readonly<Record<ViewKind, ViewRule>> = {
  today: {
    sorts: ['DATE', 'PRIORITY', 'NAME', 'ADDED', 'DEADLINE'],
    groups: ['NONE', 'PRIORITY', 'PROJECT', 'LABEL', 'DEADLINE', 'ADDED'],
    hasCompleted: true,
    hasFutureOccurrences: false,
    dueFilters: DUE_FILTERS.filter((due) => due !== 'NO_DATE'),
  },
  upcoming: {
    sorts: ['DATE', 'PRIORITY', 'NAME', 'ADDED', 'DEADLINE'],
    groups: ['NONE'],
    hasCompleted: true,
    hasFutureOccurrences: true,
    dueFilters: DUE_FILTERS.filter((due) => due !== 'NO_DATE' && due !== 'OVERDUE'),
  },
  project: {
    sorts: ['MANUAL', 'DATE', 'DEADLINE', 'PRIORITY', 'NAME', 'ADDED'],
    groups: ['NONE', 'DATE', 'DEADLINE', 'PRIORITY', 'LABEL', 'ADDED'],
    hasCompleted: true,
    hasFutureOccurrences: false,
    dueFilters: DUE_FILTERS,
  },
  label: LIST_RULE,
  filter: LIST_RULE,
};

export const PRIORITY_FILTERS: readonly number[] = [1, 2, 3, 4];

export const TODAY_VIEW_KEY: ViewKey = 'TODAY';
export const UPCOMING_VIEW_KEY: ViewKey = 'UPCOMING';
export const projectViewKey = (projectId: string): ViewKey => `project:${projectId}`;
export const labelViewKey = (labelId: string): ViewKey => `label:${labelId}`;
export const filterViewKey = (filterId: string): ViewKey => `filter:${filterId}`;

export function viewKindOf(viewKey: ViewKey): ViewKind {
  if (viewKey === 'TODAY') return 'today';
  if (viewKey === 'UPCOMING') return 'upcoming';
  if (viewKey.startsWith('project:')) return 'project';
  if (viewKey.startsWith('label:')) return 'label';
  return 'filter';
}

export function defaultViewOptions(viewKey: ViewKey): ViewOptions {
  const rule = VIEW_RULES[viewKindOf(viewKey)];
  return {
    viewKey,
    sortBy: rule.sorts[0],
    sortDirection: 'ASC',
    groupBy: 'NONE',
    filterPriority: null,
    filterLabelId: null,
    filterDue: null,
    showCompleted: rule.hasCompleted ? false : null,
    layout: 'LIST',
    showFutureOccurrences: rule.hasFutureOccurrences ? false : null,
  };
}

/** M7: the saved layout, LIST when unknown / absent (answers of a server without M7). */
export function layoutOf(options: Pick<ViewOptions, 'layout'>): Layout {
  return options.layout && LAYOUTS.includes(options.layout) ? options.layout : 'LIST';
}

/** The saved Display of a view cleaned against its rules: a value the view does not allow falls back to default. */
export function resolveViewOptions(viewKey: ViewKey, saved: readonly ViewOptions[] | undefined): ViewOptions {
  const fallback = defaultViewOptions(viewKey);
  const found = saved?.find((item) => item.viewKey === viewKey);
  if (!found) return fallback;
  const rule = VIEW_RULES[viewKindOf(viewKey)];
  const priority = found.filterPriority;
  return {
    viewKey,
    sortBy: rule.sorts.includes(found.sortBy) ? found.sortBy : fallback.sortBy,
    sortDirection: found.sortDirection === 'DESC' ? 'DESC' : 'ASC',
    groupBy: rule.groups.includes(found.groupBy) ? found.groupBy : 'NONE',
    filterPriority: priority !== null && PRIORITY_FILTERS.includes(priority) ? priority : null,
    filterLabelId: found.filterLabelId ?? null,
    filterDue: found.filterDue !== null && rule.dueFilters.includes(found.filterDue) ? found.filterDue : null,
    showCompleted: rule.hasCompleted ? found.showCompleted === true : null,
    layout: layoutOf(found),
    showFutureOccurrences: rule.hasFutureOccurrences ? found.showFutureOccurrences === true : null,
  };
}

export function isDefaultViewOptions(viewKey: ViewKey, options: ViewOptions): boolean {
  const fallback = defaultViewOptions(viewKey);
  return (
    options.sortBy === fallback.sortBy &&
    options.sortDirection === fallback.sortDirection &&
    options.groupBy === fallback.groupBy &&
    options.filterPriority === fallback.filterPriority &&
    options.filterLabelId === fallback.filterLabelId &&
    options.filterDue === fallback.filterDue &&
    options.showCompleted === fallback.showCompleted &&
    layoutOf(options) === fallback.layout &&
    (options.showFutureOccurrences ?? null) === fallback.showFutureOccurrences
  );
}

/** Spec 12.7: the app always sends sort, order and group (lowercase); filters only when set. */
export function toDisplayParams(options: ViewOptions): DisplayParams {
  const params: DisplayParams = {
    sort: options.sortBy.toLowerCase() as DisplaySortParam,
    order: options.sortDirection === 'DESC' ? 'desc' : 'asc',
    group: options.groupBy.toLowerCase() as DisplayGroupParam,
  };
  if (options.filterPriority !== null) params.filterPriority = options.filterPriority;
  if (options.filterLabelId !== null) params.filterLabelId = options.filterLabelId;
  if (options.filterDue !== null) params.filterDue = options.filterDue.toLowerCase() as DisplayDueParam;
  return params;
}

/**
 * Body of PUT view-options/{viewKey}: null fields left out (showCompleted is null on labels / filters,
 * showFutureOccurrences outside Upcoming). M7: the layout is always sent.
 */
export function toViewOptionsBody(options: ViewOptions): ViewOptionsBody {
  const body: ViewOptionsBody = {
    sortBy: options.sortBy,
    sortDirection: options.sortDirection,
    groupBy: options.groupBy,
  };
  if (options.filterPriority !== null) body.filterPriority = options.filterPriority;
  if (options.filterLabelId !== null) body.filterLabelId = options.filterLabelId;
  if (options.filterDue !== null) body.filterDue = options.filterDue;
  if (options.showCompleted !== null) body.showCompleted = options.showCompleted;
  body.layout = layoutOf(options);
  if (options.showFutureOccurrences !== null && options.showFutureOccurrences !== undefined) {
    body.showFutureOccurrences = options.showFutureOccurrences;
  }
  return body;
}
