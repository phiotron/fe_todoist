import { apiFetch } from './client';
import type { CreateSectionRequest, Section, UpdateSectionRequest } from './models';

const base = (projectId: string) => `/api/v1/projects/${encodeURIComponent(projectId)}/sections`;
const one = (projectId: string, sectionId: string) => `${base(projectId)}/${encodeURIComponent(sectionId)}`;

/** Spec 12.2: active sections by sortOrder, then archived ones (newest archive first). */
export const sectionsApi = {
  list: (projectId: string) => apiFetch<Section[]>(base(projectId)),
  create: (projectId: string, body: CreateSectionRequest, idempotencyKey: string) =>
    apiFetch<Section>(base(projectId), { method: 'POST', body, idempotencyKey }),
  update: (projectId: string, sectionId: string, body: UpdateSectionRequest) =>
    apiFetch<Section>(one(projectId, sectionId), { method: 'PATCH', body }),
  /** Permanent, together with every task of the section (open and completed). */
  remove: (projectId: string, sectionId: string) => apiFetch<void>(one(projectId, sectionId), { method: 'DELETE' }),
  /** Open tasks of the section become completed (spec 5.7). */
  archive: (projectId: string, sectionId: string) =>
    apiFetch<Section>(`${one(projectId, sectionId)}/archive`, { method: 'POST' }),
  /** Tasks stay completed. */
  unarchive: (projectId: string, sectionId: string) =>
    apiFetch<Section>(`${one(projectId, sectionId)}/unarchive`, { method: 'POST' }),
};
