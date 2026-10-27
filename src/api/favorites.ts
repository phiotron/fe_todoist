import { apiFetch } from './client';
import type { Favorite } from './models';

/** Spec 12.2: oldest first, archived projects left out. M1 only has PROJECT; M2 adds LABEL / FILTER. */
export const favoritesApi = {
  list: () => apiFetch<Favorite[]>('/api/v1/favorites'),
};
