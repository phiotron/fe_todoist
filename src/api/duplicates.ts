import { apiFetch } from './client';
import type { Project, Section } from './models';

/** M11 Move section: projectId = destination; afterId absent = last, null = first. */
export interface MoveSectionRequest {
  projectId: string;
  afterId?: string | null;
}

const project = (projectId: string) => `/api/v1/projects/${encodeURIComponent(projectId)}`;
const section = (projectId: string, sectionId: string) =>
  `${project(projectId)}/sections/${encodeURIComponent(sectionId)}`;

/** M11 F1–F3 (plan 2026-10-27-m11-chuc-nang.md). */
export const duplicatesApi = {
  /** "Copy of …" right after the original: active sections + open tasks only (201). */
  duplicateProject: (projectId: string, idempotencyKey: string) =>
    apiFetch<Project>(`${project(projectId)}/duplicate`, { method: 'POST', idempotencyKey }),
  /** Same name, right after the original, open tasks only (201). */
  duplicateSection: (projectId: string, sectionId: string, idempotencyKey: string) =>
    apiFetch<Section>(`${section(projectId, sectionId)}/duplicate`, { method: 'POST', idempotencyKey }),
  /** Every task of the section (open and completed) goes along (200). */
  moveSection: (projectId: string, sectionId: string, body: MoveSectionRequest) =>
    apiFetch<Section>(`${section(projectId, sectionId)}/move`, { method: 'POST', body }),
};
