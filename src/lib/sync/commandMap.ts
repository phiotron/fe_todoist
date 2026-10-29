import type { HttpMethod } from '../../api/client';

/** A REST write turned into a sync command (before the queue stamps `uuid` / `enqueuedAt`). */
export interface MappedCommand {
  type: string;
  args: Record<string, unknown>;
  /** Set for create commands: the id of the new record (client-made, spec 12.11). */
  tempId?: string;
}

type Body = Record<string, unknown>;
type Params = string[];

interface Route {
  method: HttpMethod;
  /** Matches the path without the query string; capture groups are the ids, in order. */
  pattern: RegExp;
  build(params: Params, body: Body, newId: () => string): MappedCommand;
}

const SEG = '([^/]+)';
const API = '^/api/v1';

function decoded(params: Params): Params {
  return params.map((p) => decodeURIComponent(p));
}

function withId(body: Body, newId: () => string): { id: string; body: Body } {
  const id = typeof body.id === 'string' && body.id ? body.id : newId();
  return { id, body: { ...body, id } };
}

function create(type: string, extra?: (params: Params) => Body): Route['build'] {
  return (params, body, newId) => {
    const { id, body: withIdBody } = withId(body, newId);
    return { type, tempId: id, args: { ...withIdBody, ...(extra ? extra(decoded(params)) : {}) } };
  };
}

function onId(type: string, extra?: (params: Params) => Body, drop: string[] = []): Route['build'] {
  return (params, body) => {
    const [id, ...rest] = decoded(params);
    const rest_ = extra ? extra([id, ...rest]) : {};
    const clean: Body = { ...body };
    for (const key of drop) delete clean[key];
    return { type, args: { ...clean, id, ...rest_ } };
  };
}

/**
 * THE extension point of the mobile side (plan 8.3): one line per REST write that can be queued. A write that matches
 * no route is NOT queued (it answers OfflineError while offline): settings (me/settings keeps its own on-device pending
 * copy), duplicate, templates, comments, attachments, Display options, sharing...
 */
export const ROUTES: readonly Route[] = [
  // projects
  { method: 'POST', pattern: new RegExp(`${API}/projects$`), build: create('project_add') },
  { method: 'PATCH', pattern: new RegExp(`${API}/projects/${SEG}$`), build: onId('project_update') },
  { method: 'DELETE', pattern: new RegExp(`${API}/projects/${SEG}$`), build: onId('project_delete') },
  { method: 'POST', pattern: new RegExp(`${API}/projects/${SEG}/move$`), build: onId('project_move') },
  { method: 'POST', pattern: new RegExp(`${API}/projects/${SEG}/archive$`), build: onId('project_archive') },
  { method: 'POST', pattern: new RegExp(`${API}/projects/${SEG}/unarchive$`), build: onId('project_unarchive') },
  // sections
  {
    method: 'POST',
    pattern: new RegExp(`${API}/projects/${SEG}/sections$`),
    build: create('section_add', ([projectId]) => ({ projectId })),
  },
  {
    method: 'PATCH',
    pattern: new RegExp(`${API}/projects/${SEG}/sections/${SEG}$`),
    build: (params, body) => sectionCommand('section_update', params, body),
  },
  {
    method: 'DELETE',
    pattern: new RegExp(`${API}/projects/${SEG}/sections/${SEG}$`),
    build: (params, body) => sectionCommand('section_delete', params, body),
  },
  {
    method: 'POST',
    pattern: new RegExp(`${API}/projects/${SEG}/sections/${SEG}/archive$`),
    build: (params, body) => sectionCommand('section_archive', params, body),
  },
  {
    method: 'POST',
    pattern: new RegExp(`${API}/projects/${SEG}/sections/${SEG}/unarchive$`),
    build: (params, body) => sectionCommand('section_unarchive', params, body),
  },
  // tasks (`version` is dropped from updates: the server applies the field changes onto its current version — plan F4)
  { method: 'POST', pattern: new RegExp(`${API}/tasks$`), build: create('task_add') },
  { method: 'PATCH', pattern: new RegExp(`${API}/tasks/${SEG}$`), build: onId('task_update', undefined, ['version']) },
  { method: 'DELETE', pattern: new RegExp(`${API}/tasks/${SEG}$`), build: onId('task_delete') },
  { method: 'POST', pattern: new RegExp(`${API}/tasks/${SEG}/close$`), build: onId('task_close') },
  { method: 'POST', pattern: new RegExp(`${API}/tasks/${SEG}/reopen$`), build: onId('task_reopen') },
  { method: 'POST', pattern: new RegExp(`${API}/tasks/${SEG}/move$`), build: onId('task_move') },
  // REVIEW (Cho duyet): the REST path has no body; the command payload is { taskId } (backend contract)
  {
    method: 'POST',
    pattern: new RegExp(`${API}/tasks/${SEG}/review/approve$`),
    build: (params) => ({ type: 'task_review_approve', args: { taskId: decoded(params)[0] } }),
  },
  {
    method: 'POST',
    pattern: new RegExp(`${API}/tasks/${SEG}/review/reject$`),
    build: (params) => ({ type: 'task_review_reject', args: { taskId: decoded(params)[0] } }),
  },
  // Undo of a return: the REST body IS the command args beside the id (backend contract)
  { method: 'POST', pattern: new RegExp(`${API}/tasks/${SEG}/review/restore$`), build: onId('task_review_restore') },
  // labels
  { method: 'POST', pattern: new RegExp(`${API}/labels$`), build: create('label_add') },
  { method: 'PATCH', pattern: new RegExp(`${API}/labels/${SEG}$`), build: onId('label_update') },
  { method: 'DELETE', pattern: new RegExp(`${API}/labels/${SEG}$`), build: onId('label_delete') },
  // filters (POST filters/validate is a read: it does not match `filters$`)
  { method: 'POST', pattern: new RegExp(`${API}/filters$`), build: create('filter_add') },
  { method: 'PATCH', pattern: new RegExp(`${API}/filters/${SEG}$`), build: onId('filter_update') },
  { method: 'DELETE', pattern: new RegExp(`${API}/filters/${SEG}$`), build: onId('filter_delete') },
  // M9 phase 2 — organise: the REST body IS the command args (reorder: {type, id, afterId}; batch: {action, taskIds, ...})
  { method: 'POST', pattern: new RegExp(`${API}/reorder$`), build: (_params, body) => ({ type: 'reorder', args: { ...body } }) },
  { method: 'POST', pattern: new RegExp(`${API}/tasks/batch$`), build: (_params, body) => ({ type: 'task_batch', args: { ...body } }) },
  {
    method: 'POST',
    pattern: new RegExp(`${API}/tasks/overdue/reschedule$`),
    build: (_params, body) => ({ type: 'task_reschedule_overdue', args: { ...body } }),
  },
  // favorites: PUT sets, DELETE clears (no body)
  { method: 'PUT', pattern: new RegExp(`${API}/projects/${SEG}/favorite$`), build: onId('project_favorite') },
  { method: 'DELETE', pattern: new RegExp(`${API}/projects/${SEG}/favorite$`), build: onId('project_unfavorite') },
  { method: 'PUT', pattern: new RegExp(`${API}/labels/${SEG}/favorite$`), build: onId('label_favorite') },
  { method: 'DELETE', pattern: new RegExp(`${API}/labels/${SEG}/favorite$`), build: onId('label_unfavorite') },
  { method: 'PUT', pattern: new RegExp(`${API}/filters/${SEG}/favorite$`), build: onId('filter_favorite') },
  { method: 'DELETE', pattern: new RegExp(`${API}/filters/${SEG}/favorite$`), build: onId('filter_unfavorite') },
  // reminders of one task (the server makes the reminder id; the app's id is only its temp id)
  {
    method: 'POST',
    pattern: new RegExp(`${API}/tasks/${SEG}/reminders$`),
    build: create('reminder_add', ([taskId]) => ({ taskId })),
  },
  {
    method: 'DELETE',
    pattern: new RegExp(`${API}/tasks/${SEG}/reminders/${SEG}$`),
    build: (params, body) => {
      const [taskId, id] = decoded(params);
      return { type: 'reminder_delete', args: { ...body, id, taskId } };
    },
  },
];

function sectionCommand(type: string, params: Params, body: Body): MappedCommand {
  const [projectId, id] = decoded(params);
  return { type, args: { ...body, id, projectId } };
}

/** Pure: the sync command of a REST write, or null when the write cannot be queued. */
export function mapRequest(
  method: HttpMethod,
  path: string,
  body: unknown,
  newId: () => string,
): MappedCommand | null {
  const pathname = path.split('?')[0];
  const payload: Body = body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Body) : {};
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const match = route.pattern.exec(pathname);
    if (match) return route.build(match.slice(1), payload, newId);
  }
  return null;
}
