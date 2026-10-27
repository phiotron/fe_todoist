import { apiFetch, buildQuery } from './client';
import type { CreateProjectRequest, MoveProjectRequest, Project, UpdateProjectRequest } from './models';

const base = (projectId: string) => `/api/v1/projects/${encodeURIComponent(projectId)}`;

/** Spec 12.2. Project and section writes are "last write wins" (no version). */
export const projectsApi = {
  /** All projects, not paged: Inbox first, then the tree (parents before children); archived=true = archived ones. */
  list: (archived = false) =>
    apiFetch<Project[]>(`/api/v1/projects${buildQuery({ archived: archived ? 'true' : undefined })}`),
  get: (projectId: string) => apiFetch<Project>(base(projectId)),
  create: (body: CreateProjectRequest, idempotencyKey: string) =>
    apiFetch<Project>('/api/v1/projects', { method: 'POST', body, idempotencyKey }),
  update: (projectId: string, body: UpdateProjectRequest) =>
    apiFetch<Project>(base(projectId), { method: 'PATCH', body }),
  /** New parent (null = root): depth ≤ 3 and no cycles, checked by the server (400). */
  move: (projectId: string, body: MoveProjectRequest) =>
    apiFetch<Project>(`${base(projectId)}/move`, { method: 'POST', body }),
  /** Permanent: sub-projects, sections and tasks go too (spec 5.7). */
  remove: (projectId: string) => apiFetch<void>(base(projectId), { method: 'DELETE' }),
  /** With its sub-projects; repeating it is harmless. */
  archive: (projectId: string) => apiFetch<Project>(`${base(projectId)}/archive`, { method: 'POST' }),
  unarchive: (projectId: string) => apiFetch<Project>(`${base(projectId)}/unarchive`, { method: 'POST' }),
  setFavorite: (projectId: string, favorite: boolean) =>
    apiFetch<Project>(`${base(projectId)}/favorite`, { method: favorite ? 'PUT' : 'DELETE' }),
};
