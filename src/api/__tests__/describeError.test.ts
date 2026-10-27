import { onlineManager } from '@tanstack/react-query';
import vi from '../../i18n/locales/vi.json';
import { describeError, errorCode, isNotFound, isVersionConflict, shortRequestId } from '../describeError';
import { ApiError, NetworkError, OfflineError, TimeoutError } from '../errors';

const api = (status: number, extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) =>
  new ApiError({ status, title: 'x', ...extra });

describe('describeError', () => {
  afterEach(() => onlineManager.setOnline(true));

  it('explains offline and unreachable-server failures', () => {
    expect(describeError(new OfflineError()).message).toBe(vi.errors.offline);
    expect(describeError(new NetworkError()).message).toBe(vi.errors.network);
    expect(describeError(new TimeoutError()).message).toBe(vi.errors.timeout);
    onlineManager.setOnline(false);
    expect(describeError(new NetworkError()).message).toBe(vi.errors.offline);
  });

  it('maps 400 field errors and keeps the first message per field', () => {
    const error = api(400, {
      errors: [
        { field: 'content', message: 'Tên không được để trống' },
        { field: 'content', message: 'bị bỏ qua' },
      ],
    });
    expect(describeError(error)).toEqual({ message: vi.errors.invalid, fields: { content: 'Tên không được để trống' } });
  });

  it('shows the server detail of a 400 without field errors (e.g. subtask too deep)', () => {
    expect(describeError(api(400, { detail: 'Công việc con tối đa 4 cấp' })).message).toBe('Công việc con tối đa 4 cấp');
  });

  it('maps 403, 404 and 429 to fixed messages', () => {
    expect(describeError(api(403)).message).toBe(vi.errors.forbidden);
    expect(describeError(api(404)).message).toBe(vi.errors.notFound);
    expect(describeError(api(429)).message).toBe(vi.errors.tooManyRequests);
  });

  it('tells 409s apart by code', () => {
    const conflict = api(409, { code: 'version-conflict', current: { id: 't1', version: 2 } });
    expect(describeError(conflict).message).toBe(vi.errors.versionConflict);
    expect(isVersionConflict(conflict)).toBe(true);
    expect(describeError(api(409, { code: 'project-archived' })).message).toBe(vi.errors.projectArchived);
    expect(describeError(api(409, { code: 'section-archived' })).message).toBe(vi.errors.sectionArchived);
    expect(describeError(api(409, { code: 'parent-completed' })).message).toBe(vi.errors.parentCompleted);
    expect(describeError(api(409, { code: 'task-completed' })).message).toBe(vi.errors.taskCompleted);
    expect(describeError(api(409, { code: 'idempotency-in-progress' })).message).toBe(vi.errors.inProgress);
    expect(isVersionConflict(api(409, { code: 'project-archived' }))).toBe(false);
    expect(describeError(api(409, { detail: 'Lý do khác' })).message).toBe('Lý do khác');
    expect(describeError(api(409)).message).toBe(vi.errors.conflict);
  });

  it('tells 422s apart by code and explains Pro limits with their maximum', () => {
    expect(describeError(api(422, { code: 'target-archived' })).message).toBe(vi.errors.targetArchived);
    expect(describeError(api(422, { code: 'idempotency-mismatch' })).message).toBe(vi.errors.idempotencyMismatch);
    expect(describeError(api(422, { code: 'limit-reached', limit: 'PROJECT_SECTIONS', max: 20 })).message).toBe(
      vi.errors.limit.projectSections.replace('{{max}}', '20'),
    );
    expect(describeError(api(422, { code: 'limit-reached', limit: 'ACTIVE_PROJECTS', max: 300 })).message).toBe(
      vi.errors.limit.activeProjects.replace('{{max}}', '300'),
    );
    expect(describeError(api(422, { code: 'limit-reached', limit: 'PROJECTS', max: 500 })).message).toBe(
      vi.errors.limit.projects.replace('{{max}}', '500'),
    );
    expect(describeError(api(422, { code: 'limit-reached', limit: 'PROJECT_ACTIVE_TASKS', max: 300 })).message).toBe(
      vi.errors.limit.projectActiveTasks.replace('{{max}}', '300'),
    );
    expect(describeError(api(422, { code: 'limit-reached', limit: 'PROJECT_SECTIONS', max: 20 })).message).toBe(
      vi.errors.limit.projectSections.replace('{{max}}', '20'),
    );
    expect(describeError(api(422, { code: 'limit-reached', limit: 'PROJECT_SECTIONS_TOTAL', max: 100 })).message).toBe(
      vi.errors.limit.projectSectionsTotal.replace('{{max}}', '100'),
    );
    expect(describeError(api(422, { code: 'limit-reached', limit: 'REMINDERS', max: 500 })).message).toBe(
      vi.errors.limit.other.replace('{{max}}', '500'),
    );
    expect(describeError(api(422)).message).toBe(vi.errors.targetUnavailable);
  });

  it('adds a short requestId to 5xx messages so the user can report it', () => {
    const error = api(500, { requestId: '7f3c9a12-aaaa-4bbb-8ccc-dddddddddddd' });
    expect(describeError(error).message).toBe(vi.errors.server.replace('{{code}}', '7f3c9a12'));
    expect(describeError(api(503)).message).toBe(vi.errors.unknown);
    expect(shortRequestId(undefined)).toBeUndefined();
  });

  it('falls back to the generic message for anything else', () => {
    expect(describeError(new Error('boom'))).toEqual({ message: vi.errors.unknown, fields: {} });
    expect(isNotFound(api(404))).toBe(true);
    expect(isNotFound(new Error('x'))).toBe(false);
    expect(errorCode(api(409, { code: 'section-archived' }))).toBe('section-archived');
    expect(errorCode(new Error('x'))).toBeUndefined();
  });
});
