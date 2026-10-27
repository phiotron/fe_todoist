import { useQuery } from '@tanstack/react-query';
import { favoritesApi } from '../../api/favorites';
import type { Favorite } from '../../api/models';
import { queryKeys } from '../../api/queryKeys';

const NONE: Favorite[] = [];

/** GET favorites as the server sends it (every kind, oldest first) — the same cache entry as M1's `useFavoriteProjects`. */
export function useFavoriteTargets(): Favorite[] {
  const query = useQuery({ queryKey: queryKeys.favorites.list(), queryFn: () => favoritesApi.list() });
  return query.data ?? NONE;
}
