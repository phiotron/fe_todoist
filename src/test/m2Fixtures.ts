import type { Filter } from '../api/filters';
import type { Label } from '../api/labels';
import type { ViewOptions } from '../api/viewOptions';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-auto-${(seq += 1)}`;

export function makeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: nextId('label'),
    name: 'label',
    color: 'charcoal',
    isFavorite: false,
    sortOrder: 1024,
    ...overrides,
  };
}

export function makeFilter(overrides: Partial<Filter> = {}): Filter {
  return {
    id: nextId('filter'),
    name: 'Filter',
    query: 'today',
    color: 'charcoal',
    isFavorite: false,
    sortOrder: 1024,
    ...overrides,
  };
}

/** A saved Display row as GET view-options returns it (nulls for unset fields). */
export function makeViewOptions(viewKey: string, overrides: Partial<ViewOptions> = {}): ViewOptions {
  return {
    viewKey,
    sortBy: 'DATE',
    sortDirection: 'ASC',
    groupBy: 'NONE',
    filterPriority: null,
    filterLabelId: null,
    filterDue: null,
    showCompleted: null,
    // M7
    layout: 'LIST',
    showFutureOccurrences: null,
    ...overrides,
  };
}
