import { apiFetch } from './client';
import type { ProjectColor } from './models';

/** FilterResponse (spec 12.7). */
export interface Filter {
  id: string;
  name: string;
  query: string;
  color: ProjectColor;
  isFavorite: boolean;
  sortOrder: number;
}

export interface CreateFilterRequest {
  /** Client-generated UUID (spec 12.11); optional, not sent by the M2 screens. */
  id?: string;
  name: string;
  query: string;
  color?: ProjectColor;
}

export interface UpdateFilterRequest {
  name?: string;
  query?: string;
  color?: ProjectColor;
}

/** POST filters/validate → the query split on its top-level commas (one list per part). */
export interface FilterValidation {
  parts: string[];
}

const BASE = '/api/v1/filters';
const filterPath = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export const filtersApi = {
  list: () => apiFetch<Filter[]>(BASE),
  create: (body: CreateFilterRequest, idempotencyKey: string) =>
    apiFetch<Filter>(BASE, { method: 'POST', body, idempotencyKey }),
  update: (id: string, body: UpdateFilterRequest) => apiFetch<Filter>(filterPath(id), { method: 'PATCH', body }),
  remove: (id: string) => apiFetch<void>(filterPath(id), { method: 'DELETE' }),
  setFavorite: (id: string, favorite: boolean) =>
    apiFetch<Filter>(`${filterPath(id)}/favorite`, { method: favorite ? 'PUT' : 'DELETE' }),
  reorder: (id: string, afterId: string | null) =>
    apiFetch<unknown>('/api/v1/reorder', { method: 'POST', body: { type: 'FILTER', id, afterId } }),
  /** 400 filter-syntax (with `position`) when the query is wrong. */
  validate: (query: string) =>
    apiFetch<FilterValidation>(`${BASE}/validate`, { method: 'POST', body: { query } }),
};
