import { skipToken, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { CreateSectionRequest, UpdateSectionRequest } from '../../api/models';
import { queryKeys } from '../../api/queryKeys';
import { reorderApi } from '../../api/reorder';
import { sectionsApi } from '../../api/sections';
import { useDataMutation } from '../../lib/useDataMutation';

/** Sections of a project: active ones by sortOrder, archived ones apart (grey at the end, spec 9.2). */
export function useSections(projectId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.sections.list(projectId ?? ''),
    queryFn: projectId ? () => sectionsApi.list(projectId) : skipToken,
  });
  const sections = useMemo(
    () => (query.data ?? []).filter((s) => s.archivedAt === null).sort((a, b) => a.sortOrder - b.sortOrder),
    [query.data],
  );
  const archived = useMemo(() => (query.data ?? []).filter((s) => s.archivedAt !== null), [query.data]);
  return { query, sections, archived };
}

export const useCreateSection = (projectId: string) =>
  useDataMutation(({ body, idempotencyKey }: { body: CreateSectionRequest; idempotencyKey: string }) =>
    sectionsApi.create(projectId, body, idempotencyKey),
  );

export const useUpdateSection = (projectId: string) =>
  useDataMutation(({ sectionId, body }: { sectionId: string; body: UpdateSectionRequest }) =>
    sectionsApi.update(projectId, sectionId, body),
  );

export const useArchiveSection = (projectId: string) =>
  useDataMutation((sectionId: string) => sectionsApi.archive(projectId, sectionId));

export const useUnarchiveSection = (projectId: string) =>
  useDataMutation((sectionId: string) => sectionsApi.unarchive(projectId, sectionId));

export const useDeleteSection = (projectId: string) =>
  useDataMutation((sectionId: string) => sectionsApi.remove(projectId, sectionId));

/** `afterId` is always sent (null = first); archived sections are never reordered (409). No `version` changes. */
export const useReorderSection = () =>
  useDataMutation(
    ({ id, afterId }: { id: string; afterId: string | null }) => reorderApi.reorder({ type: 'SECTION', id, afterId }),
    { keepDetail: true },
  );
