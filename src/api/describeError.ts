import { onlineManager } from '@tanstack/react-query';
import i18n from '../i18n';
import { ApiError, NetworkError, OfflineError, TimeoutError } from './errors';

export interface ErrorView {
  /** One sentence for the screen or form. */
  message: string;
  /** Server field errors (400) keyed by request field name, first message per field. */
  fields: Record<string, string>;
}

/** First 8 characters of the request id: enough to find the log line, short enough to read out. */
export function shortRequestId(requestId: string | undefined): string | undefined {
  return requestId ? requestId.slice(0, 8) : undefined;
}

/** `code` of a ProblemDetail (spec 12.10), undefined for anything else. */
export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

/** 409 caused by a stale `version`: the server may send the latest copy in `current`. */
function hasVersionConflict(error: ApiError): boolean {
  return error.status === 409 && (error.code === 'version-conflict' || (error.code === undefined && error.current !== undefined));
}

export function isVersionConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && hasVersionConflict(error);
}

export function isNotFound(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 404;
}

function view(message: string): ErrorView {
  return { message, fields: {} };
}

/** 422 limit-reached: one sentence per LimitKind (spec 2.1); kinds of later milestones use the generic one. */
function limitMessage(limit: string | undefined, max: number | undefined): string {
  const n = max ?? '';
  switch (limit) {
    case 'ACTIVE_PROJECTS':
      return i18n.t('errors.limit.activeProjects', { max: n });
    case 'PROJECTS':
      return i18n.t('errors.limit.projects', { max: n });
    case 'PROJECT_ACTIVE_TASKS':
      return i18n.t('errors.limit.projectActiveTasks', { max: n });
    case 'PROJECT_SECTIONS':
      return i18n.t('errors.limit.projectSections', { max: n });
    case 'PROJECT_SECTIONS_TOTAL':
      return i18n.t('errors.limit.projectSectionsTotal', { max: n });
    case 'LABELS':
      return i18n.t('errors.limit.labels', { max: n });
    case 'FILTERS':
      return i18n.t('errors.limit.filters', { max: n });
    case 'REMINDERS':
      return i18n.t('errors.limit.reminders', { max: n });
    case 'TEMPLATES': // M11
      return i18n.t('templates.limitReached', { max: n });
    case 'PROJECT_MEMBERS':
      return i18n.t('errors.limit.projectMembers', { max: n });
    default:
      return i18n.t('errors.limit.other', { max: n });
  }
}

function conflictMessage(error: ApiError): string {
  if (hasVersionConflict(error)) return i18n.t('errors.versionConflict');
  switch (error.code) {
    case 'project-archived':
      return i18n.t('errors.projectArchived');
    case 'section-archived':
      return i18n.t('errors.sectionArchived');
    case 'parent-completed':
      return i18n.t('errors.parentCompleted');
    case 'task-completed':
      return i18n.t('errors.taskCompleted');
    case 'idempotency-in-progress':
      return i18n.t('errors.inProgress');
    case 'review-not-pending':
      return i18n.t('review.notPending');
    case 'review-not-restorable':
      return i18n.t('review.notRestorable');
    case 'label-name-taken':
      return i18n.t('errors.labelNameTaken');
    default:
      return error.detail || i18n.t('errors.conflict');
  }
}

function unprocessableMessage(error: ApiError): string {
  switch (error.code) {
    case 'target-archived':
      return i18n.t('errors.targetArchived');
    case 'limit-reached':
      return limitMessage(error.limit, error.max);
    case 'idempotency-mismatch':
      return i18n.t('errors.idempotencyMismatch');
    default:
      return i18n.t('errors.targetUnavailable');
  }
}

/** Turns any error thrown by apiFetch / useDataMutation into a localized message (spec 9.3). */
export function describeError(error: unknown): ErrorView {
  if (error instanceof OfflineError) return view(i18n.t('errors.offline'));
  if (error instanceof TimeoutError) return view(i18n.t('errors.timeout'));
  if (error instanceof NetworkError) {
    return view(onlineManager.isOnline() ? i18n.t('errors.network') : i18n.t('errors.offline'));
  }
  if (!(error instanceof ApiError)) return view(i18n.t('errors.unknown'));

  if (error.status >= 500) {
    const code = shortRequestId(error.requestId);
    return view(code ? i18n.t('errors.server', { code }) : i18n.t('errors.unknown'));
  }
  switch (error.status) {
    case 400: {
      if (error.code === 'filter-syntax') return view(i18n.t('errors.filterSyntax'));
      const fields: Record<string, string> = {};
      for (const fieldError of error.errors ?? []) fields[fieldError.field] ??= fieldError.message;
      const message = Object.keys(fields).length > 0 ? i18n.t('errors.invalid') : error.detail || i18n.t('errors.invalid');
      return { message, fields };
    }
    case 401:
      return view(i18n.t('auth.errors.sessionExpired'));
    case 403:
      // PERM: a Member / Guest of a team project tried a write other than completing a task
      if (error.code === 'team-admin-only') return view(i18n.t('team.adminOnly.error'));
      return view(i18n.t('errors.forbidden'));
    case 404:
      return view(i18n.t('errors.notFound'));
    case 409:
      return view(conflictMessage(error));
    case 422:
      return view(unprocessableMessage(error));
    case 429:
      return view(i18n.t('errors.tooManyRequests'));
    default:
      return view(error.detail || i18n.t('errors.unknown'));
  }
}
