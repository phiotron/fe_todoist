import { tokenStore } from '../../lib/tokenStore';
import { createTestQueryClient } from '../../test/render';
import { jsonResponse, mockFetch } from '../../test/http';
import { inboxTeamApi, inboxTeamQueryKey } from '../inboxTeam';
import { invalidateData } from '../queryKeys';

describe('inboxTeamApi', () => {
  it('asks GET tasks?view=inbox_team with a page size and the cursor', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [], nextCursor: null }));

    await inboxTeamApi.list('abc');

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/v1/tasks');
    expect(url.searchParams.get('view')).toBe('inbox_team');
    expect(url.searchParams.get('limit')).toBe('100');
    expect(url.searchParams.get('cursor')).toBe('abc');
  });

  it('is refreshed by every data write and every sync (invalidateData covers its key)', async () => {
    const client = createTestQueryClient();
    client.setQueryData(inboxTeamQueryKey, { pages: [], pageParams: [] });
    await invalidateData(client);
    expect(client.getQueryState(inboxTeamQueryKey)?.isInvalidated).toBe(true);
  });
});
