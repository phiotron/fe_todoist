import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { backupKeys, backupsApi } from '../../api/backups';
import { duplicatesApi, type MoveSectionRequest } from '../../api/duplicates';
import {
  parseTemplateRef,
  templateKeys,
  templatesApi,
  type ApplyTemplateRequest,
  type SaveTemplateRequest,
  type TemplateRef,
} from '../../api/templates';
import { useDataMutation } from '../../lib/useDataMutation';

/** My templates (newest first). `enabled` = false until a sheet that needs them opens. */
export function useMyTemplates(enabled = true) {
  return useQuery({ queryKey: templateKeys.mine(), queryFn: () => templatesApi.list(), enabled });
}

/** Built-in templates; the texts follow the UI language (Accept-Language), so the language is part of the key. */
export function useLibraryTemplates(enabled = true) {
  const { i18n } = useTranslation();
  return useQuery({ queryKey: templateKeys.library(i18n.language), queryFn: () => templatesApi.library(), enabled });
}

/** Preview of `/templates/[id]` (uuid or `library:<key>`). */
export function useTemplateDetail(param: string) {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: templateKeys.detail(param, i18n.language),
    queryFn: () => templatesApi.detail(parseTemplateRef(param)),
  });
}

export const useSaveTemplate = () =>
  useDataMutation(({ body, idempotencyKey }: { body: SaveTemplateRequest; idempotencyKey: string }) =>
    templatesApi.save(body, idempotencyKey),
  );

export const useDeleteTemplate = () => useDataMutation((id: string) => templatesApi.remove(id));

export const useApplyTemplate = () =>
  useDataMutation(
    ({ ref, body, idempotencyKey }: { ref: TemplateRef; body: ApplyTemplateRequest; idempotencyKey: string }) =>
      templatesApi.apply(ref, body, idempotencyKey),
  );

export const useDuplicateProject = () =>
  useDataMutation(({ projectId, idempotencyKey }: { projectId: string; idempotencyKey: string }) =>
    duplicatesApi.duplicateProject(projectId, idempotencyKey),
  );

export const useDuplicateSection = (projectId: string) =>
  useDataMutation(({ sectionId, idempotencyKey }: { sectionId: string; idempotencyKey: string }) =>
    duplicatesApi.duplicateSection(projectId, sectionId, idempotencyKey),
  );

export const useMoveSection = (projectId: string) =>
  useDataMutation(({ sectionId, body }: { sectionId: string; body: MoveSectionRequest }) =>
    duplicatesApi.moveSection(projectId, sectionId, body),
  );

/** Daily server backups (view only). */
export function useBackups() {
  return useQuery({ queryKey: backupKeys.list(), queryFn: () => backupsApi.list() });
}
