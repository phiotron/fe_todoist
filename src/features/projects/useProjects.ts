import { skipToken, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { favoritesApi } from '../../api/favorites';
import type { CreateProjectRequest, MoveProjectRequest, Project, UpdateProjectRequest } from '../../api/models';
import { projectsApi } from '../../api/projects';
import { queryKeys } from '../../api/queryKeys';
import { reorderApi } from '../../api/reorder';
import { useDataMutation } from '../../lib/useDataMutation';
import { projectTreeRows } from './projectTree';

/** Active projects (not paged, spec 12.2): the Inbox apart, the others in tree order. */
export function useProjects() {
  const query = useQuery({ queryKey: queryKeys.projects.list(false), queryFn: () => projectsApi.list(false) });
  const all = query.data;
  const inbox = useMemo(() => all?.find((project) => project.isInbox), [all]);
  const projects = useMemo(() => projectTreeRows(all ?? []).map((row) => row.project), [all]);
  const byId = useMemo(() => new Map((all ?? []).map((project) => [project.id, project])), [all]);
  return { query, all: all ?? [], projects, inbox, byId };
}

export function useArchivedProjects() {
  const query = useQuery({ queryKey: queryKeys.projects.list(true), queryFn: () => projectsApi.list(true) });
  return { query, projects: query.data ?? [] };
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId ?? ''),
    queryFn: projectId ? () => projectsApi.get(projectId) : skipToken,
  });
}

/** Favorite projects in the order of GET favorites (oldest first); ids that are not active projects are skipped. */
export function useFavoriteProjects(): Project[] {
  const { byId } = useProjects();
  const favorites = useQuery({ queryKey: queryKeys.favorites.list(), queryFn: () => favoritesApi.list() });
  return useMemo(
    () =>
      (favorites.data ?? [])
        .filter((favorite) => favorite.targetType === 'PROJECT')
        .map((favorite) => byId.get(favorite.targetId))
        .filter((project): project is Project => project !== undefined),
    [favorites.data, byId],
  );
}

export const useCreateProject = () =>
  useDataMutation(({ body, idempotencyKey }: { body: CreateProjectRequest; idempotencyKey: string }) =>
    projectsApi.create(body, idempotencyKey),
  );

export const useUpdateProject = () =>
  useDataMutation(({ projectId, body }: { projectId: string; body: UpdateProjectRequest }) =>
    projectsApi.update(projectId, body),
  );

export const useMoveProject = () =>
  useDataMutation(({ projectId, body }: { projectId: string; body: MoveProjectRequest }) =>
    projectsApi.move(projectId, body),
  );

export const useArchiveProject = () => useDataMutation((projectId: string) => projectsApi.archive(projectId));
export const useUnarchiveProject = () => useDataMutation((projectId: string) => projectsApi.unarchive(projectId));
export const useDeleteProject = () => useDataMutation((projectId: string) => projectsApi.remove(projectId));

export const useSetProjectFavorite = () =>
  useDataMutation(({ projectId, favorite }: { projectId: string; favorite: boolean }) =>
    projectsApi.setFavorite(projectId, favorite),
  );

/** `afterId` is always sent (null = first). Reorder never changes a `version`, so open task details are not refreshed. */
export const useReorderProject = () =>
  useDataMutation(
    ({ id, afterId }: { id: string; afterId: string | null }) => reorderApi.reorder({ type: 'PROJECT', id, afterId }),
    { keepDetail: true },
  );
