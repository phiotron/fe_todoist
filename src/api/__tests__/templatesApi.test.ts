import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, requestAt } from '../../test/http';
import { backupsApi } from '../backups';
import { duplicatesApi } from '../duplicates';
import { parseTemplateRef, templateRefParam, templatesApi } from '../templates';

const pathOf = (url: string) => url.replace(/^.*\/api\/v1/, '');

describe('M11 api wrappers', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('templates: list / library / detail of both kinds / save with a key / delete', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await templatesApi.list();
    await templatesApi.library();
    await templatesApi.detail({ source: 'MINE', id: 't1' });
    await templatesApi.detail({ source: 'LIBRARY', key: 'weekly-planning' });
    await templatesApi.save({ projectId: 'p1', name: 'Mẫu' }, 'key-1');
    await templatesApi.remove('t1');

    expect(pathOf(requestAt(fetchMock, 0).url)).toBe('/templates');
    expect(pathOf(requestAt(fetchMock, 1).url)).toBe('/templates/library');
    expect(pathOf(requestAt(fetchMock, 2).url)).toBe('/templates/t1');
    expect(pathOf(requestAt(fetchMock, 3).url)).toBe('/templates/library/weekly-planning');
    const save = requestAt(fetchMock, 4);
    expect(save).toMatchObject({ method: 'POST', body: { projectId: 'p1', name: 'Mẫu' } });
    expect(save.headers['Idempotency-Key']).toBe('key-1');
    expect(requestAt(fetchMock, 5)).toMatchObject({ method: 'DELETE' });
  });

  it('apply posts to the template of the right kind with an Idempotency-Key', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(201, {}));

    await templatesApi.apply({ source: 'MINE', id: 't1' }, { name: 'X' }, 'k1');
    await templatesApi.apply({ source: 'LIBRARY', key: 'study-plan' }, { projectId: 'p9' }, 'k2');

    expect(pathOf(requestAt(fetchMock, 0).url)).toBe('/templates/t1/apply');
    expect(requestAt(fetchMock, 0).body).toEqual({ name: 'X' });
    expect(requestAt(fetchMock, 0).headers['Idempotency-Key']).toBe('k1');
    expect(pathOf(requestAt(fetchMock, 1).url)).toBe('/templates/library/study-plan/apply');
    expect(requestAt(fetchMock, 1).body).toEqual({ projectId: 'p9' });
  });

  it('route param round-trips for both kinds', () => {
    expect(parseTemplateRef('abc')).toEqual({ source: 'MINE', id: 'abc' });
    expect(parseTemplateRef('library:eisenhower-matrix')).toEqual({ source: 'LIBRARY', key: 'eisenhower-matrix' });
    expect(templateRefParam({ source: 'LIBRARY', key: 'k' })).toBe('library:k');
    expect(templateRefParam({ source: 'MINE', id: 'u' })).toBe('u');
  });

  it('duplicate project / section and move section', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(201, {}));

    await duplicatesApi.duplicateProject('p1', 'k1');
    await duplicatesApi.duplicateSection('p1', 's1', 'k2');
    await duplicatesApi.moveSection('p1', 's1', { projectId: 'p2' });

    expect(pathOf(requestAt(fetchMock, 0).url)).toBe('/projects/p1/duplicate');
    expect(requestAt(fetchMock, 0).headers['Idempotency-Key']).toBe('k1');
    expect(pathOf(requestAt(fetchMock, 1).url)).toBe('/projects/p1/sections/s1/duplicate');
    expect(requestAt(fetchMock, 1).headers['Idempotency-Key']).toBe('k2');
    expect(pathOf(requestAt(fetchMock, 2).url)).toBe('/projects/p1/sections/s1/move');
    expect(requestAt(fetchMock, 2)).toMatchObject({ method: 'POST', body: { projectId: 'p2' } });
  });

  it('backups: list only (no restore / download call exists)', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await backupsApi.list();

    expect(pathOf(requestAt(fetchMock, 0).url)).toBe('/backups');
    expect(Object.keys(backupsApi)).toEqual(['list']);
  });
});
