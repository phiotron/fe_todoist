import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch } from '../../test/http';
import { routeFetch } from '../../test/m3Routes';
import { pinTargetsApi } from '../pinTargets';

describe('pinTargetsApi', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('projects: id + name of every active project except Inbox', async () => {
    routeFetch(mockFetch(), {
      'GET /api/v1/projects': () =>
        jsonResponse(200, [
          { id: 'inbox', name: 'Inbox', isInbox: true, archivedAt: null, color: null },
          { id: 'p1', name: 'Marketing', isInbox: false, archivedAt: null, color: 'teal' },
          { id: 'p2', name: 'Old', isInbox: false, archivedAt: '2026-10-01T00:00:00Z', color: 'red' },
        ]),
    });

    await expect(pinTargetsApi.projects()).resolves.toEqual([{ id: 'p1', name: 'Marketing' }]);
  });

  it('labels and filters: id + name', async () => {
    routeFetch(mockFetch(), {
      'GET /api/v1/labels': () => jsonResponse(200, [{ id: 'l1', name: 'urgent', color: 'red', isFavorite: false, sortOrder: 1 }]),
      'GET /api/v1/filters': () => jsonResponse(200, [{ id: 'f1', name: 'Next 7 days', query: '7 days', color: 'blue' }]),
    });

    await expect(pinTargetsApi.labels()).resolves.toEqual([{ id: 'l1', name: 'urgent' }]);
    await expect(pinTargetsApi.filters()).resolves.toEqual([{ id: 'f1', name: 'Next 7 days' }]);
  });
});
