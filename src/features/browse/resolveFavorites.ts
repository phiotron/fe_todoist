import type { Filter } from '../../api/filters';
import type { Label } from '../../api/labels';
import type { Favorite, Project } from '../../api/models';

export type FavoriteEntry =
  | { type: 'PROJECT'; id: string; project: Project }
  | { type: 'LABEL'; id: string; label: Label }
  | { type: 'FILTER'; id: string; filter: Filter };

/**
 * Favorites in GET favorites order (oldest first, spec 5.7), each matched to its loaded item; a target missing from
 * the lists (deleted meanwhile, archived project, list still loading) is skipped.
 */
export function resolveFavorites(
  favorites: readonly Favorite[],
  projects: readonly Project[],
  labels: readonly Label[],
  filters: readonly Filter[],
): FavoriteEntry[] {
  const projectById = new Map(projects.map((item) => [item.id, item]));
  const labelById = new Map(labels.map((item) => [item.id, item]));
  const filterById = new Map(filters.map((item) => [item.id, item]));
  const entries: FavoriteEntry[] = [];
  for (const favorite of favorites) {
    const id = favorite.targetId;
    if (favorite.targetType === 'PROJECT') {
      const project = projectById.get(id);
      if (project) entries.push({ type: 'PROJECT', id, project });
    } else if (favorite.targetType === 'LABEL') {
      const label = labelById.get(id);
      if (label) entries.push({ type: 'LABEL', id, label });
    } else {
      const filter = filterById.get(id);
      if (filter) entries.push({ type: 'FILTER', id, filter });
    }
  }
  return entries;
}
