import { apiFetch } from './client';
import type { ReorderRequest, ReorderResponse } from './models';

/**
 * Spec 12.4 / 3.1: put `id` right after `afterId` in the same container (null = top). `afterId` is REQUIRED in the
 * type (and so always in the body); changing container = move. Does not change any `version`.
 */
export const reorderApi = {
  reorder: (body: ReorderRequest) => apiFetch<ReorderResponse>('/api/v1/reorder', { method: 'POST', body }),
};
