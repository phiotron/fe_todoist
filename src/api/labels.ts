import { apiFetch } from './client';
import type { ProjectColor } from './models';

/** LabelResponse (spec 12.7). Personal labels only in M2; shared labels arrive with M8. */
export interface Label {
  id: string;
  name: string;
  color: ProjectColor;
  isFavorite: boolean;
  sortOrder: number;
}

export interface CreateLabelRequest {
  /**
   * Client-generated UUID (spec 12.11, 3.1 C8): idempotent by id, 409 `id-conflict` when it clashes. Optional — the
   * M2 screens do not send one (they rely on the Idempotency-Key); M9 offline creation will.
   */
  id?: string;
  name: string;
  color?: ProjectColor;
}

export interface UpdateLabelRequest {
  name?: string;
  color?: ProjectColor;
}

const BASE = '/api/v1/labels';
const labelPath = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export const labelsApi = {
  list: () => apiFetch<Label[]>(BASE),
  create: (body: CreateLabelRequest, idempotencyKey: string) =>
    apiFetch<Label>(BASE, { method: 'POST', body, idempotencyKey }),
  update: (id: string, body: UpdateLabelRequest) => apiFetch<Label>(labelPath(id), { method: 'PATCH', body }),
  remove: (id: string) => apiFetch<void>(labelPath(id), { method: 'DELETE' }),
  setFavorite: (id: string, favorite: boolean) =>
    apiFetch<Label>(`${labelPath(id)}/favorite`, { method: favorite ? 'PUT' : 'DELETE' }),
  /** "Put this label right after afterId" (null = first), spec 12.4. */
  reorder: (id: string, afterId: string | null) =>
    apiFetch<unknown>('/api/v1/reorder', { method: 'POST', body: { type: 'LABEL', id, afterId } }),
};
