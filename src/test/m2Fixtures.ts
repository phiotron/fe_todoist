import type { Filter } from '../api/filters';
import type { Label } from '../api/labels';

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
