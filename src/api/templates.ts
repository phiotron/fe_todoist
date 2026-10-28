import { apiFetch } from './client';
import type { Project } from './models';

/*
 * M11 templates (plan 2026-10-27-m11-chuc-nang.md, F5–F7). Types are declared by hand with the backend DTO names
 * (types.gen.ts is regenerated at integration time).
 */

export type TemplateCategory = 'FEATURED' | 'PRODUCTIVITY_METHODS' | 'POPULAR';

/** A task of a template: no dates / reminders / labels; children = sub-tasks. */
export interface TemplateTaskItem {
  content: string;
  description: string;
  priority: number;
  children: TemplateTaskItem[];
}

export interface TemplateSectionItem {
  name: string;
  description: string;
  tasks: TemplateTaskItem[];
}

/** "My templates" row (GET /templates, POST /templates). */
export interface TemplateResponse {
  id: string;
  name: string;
  description: string;
  color: string;
  sectionCount: number;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Built-in template, texts in the request language (Accept-Language). */
export interface LibraryTemplateResponse {
  key: string;
  category: TemplateCategory;
  name: string;
  description: string;
  color: string;
  sectionCount: number;
  taskCount: number;
}

/** Preview of one template: id = uuid (MINE) or key (LIBRARY). */
export interface TemplateDetailResponse {
  id: string;
  source: 'MINE' | 'LIBRARY';
  category: TemplateCategory | null;
  name: string;
  description: string;
  color: string;
  sectionCount: number;
  taskCount: number;
  tasks: TemplateTaskItem[];
  sections: TemplateSectionItem[];
}

export interface SaveTemplateRequest {
  projectId: string;
  /** Absent = the project name. */
  name?: string;
  description?: string;
}

/** projectId absent = create a new root project (201); present = append to that project (200). */
export interface ApplyTemplateRequest {
  projectId?: string;
  name?: string;
  color?: string;
}

/**
 * Reference used in the route `/templates/[id]`: a uuid for my templates, `library:<key>` for built-in ones.
 */
export type TemplateRef = { source: 'MINE'; id: string } | { source: 'LIBRARY'; key: string };

const LIBRARY_PREFIX = 'library:';

export function templateRefParam(ref: TemplateRef): string {
  return ref.source === 'MINE' ? ref.id : `${LIBRARY_PREFIX}${ref.key}`;
}

export function parseTemplateRef(param: string): TemplateRef {
  return param.startsWith(LIBRARY_PREFIX)
    ? { source: 'LIBRARY', key: param.slice(LIBRARY_PREFIX.length) }
    : { source: 'MINE', id: param };
}

const BASE = '/api/v1/templates';
const mine = (id: string) => `${BASE}/${encodeURIComponent(id)}`;
const library = (key: string) => `${BASE}/library/${encodeURIComponent(key)}`;

export const templatesApi = {
  list: () => apiFetch<TemplateResponse[]>(BASE),
  library: () => apiFetch<LibraryTemplateResponse[]>(`${BASE}/library`),
  detail: (ref: TemplateRef) =>
    apiFetch<TemplateDetailResponse>(ref.source === 'MINE' ? mine(ref.id) : library(ref.key)),
  save: (body: SaveTemplateRequest, idempotencyKey: string) =>
    apiFetch<TemplateResponse>(BASE, { method: 'POST', body, idempotencyKey }),
  remove: (id: string) => apiFetch<void>(mine(id), { method: 'DELETE' }),
  apply: (ref: TemplateRef, body: ApplyTemplateRequest, idempotencyKey: string) =>
    apiFetch<Project>(`${ref.source === 'MINE' ? mine(ref.id) : library(ref.key)}/apply`, {
      method: 'POST',
      body,
      idempotencyKey,
    }),
};

/** Query keys of M11 templates ("templates" is a data root: every write refreshes it). */
export const templateKeys = {
  all: ['templates'] as const,
  mine: () => ['templates', 'mine'] as const,
  library: (language: string) => ['templates', 'library', language] as const,
  detail: (param: string, language: string) => ['templates', 'detail', param, language] as const,
};
