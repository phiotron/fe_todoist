import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, requestAt } from '../../test/http';
import { settingsApi, type SettingsResponse } from '../settings';

const body: SettingsResponse = {
  theme: 'TASKLY',
  appearance: 'AUTO',
  locale: 'vi',
  timeZone: 'Asia/Ho_Chi_Minh',
  startDay: 1,
  nextWeek: 1,
  weekendStartDay: 6,
  dateFormat: 'DMY',
  timeFormat: 'H24',
  startPage: 'TODAY',
  smartDateRecognition: true,
  swipeLeft: 'SCHEDULE',
  swipeRight: 'COMPLETE',
  navTabs: ['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'],
};

describe('settingsApi', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('get reads /me/settings with the bearer token', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, body));

    await expect(settingsApi.get()).resolves.toEqual(body);

    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/me\/settings$/);
    expect(request.method).toBe('GET');
    expect(request.headers.Authorization).toBe('Bearer acc-1');
  });

  it('update sends only the changed fields with PATCH', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ...body, theme: 'KALE', navTabs: ['TODAY', 'INBOX', 'BROWSE'] }));

    await expect(
      settingsApi.update({ theme: 'KALE', navTabs: ['TODAY', 'INBOX', 'BROWSE'] }),
    ).resolves.toMatchObject({ theme: 'KALE' });

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('PATCH');
    expect(request.url).toMatch(/\/api\/v1\/me\/settings$/);
    expect(request.body).toEqual({ theme: 'KALE', navTabs: ['TODAY', 'INBOX', 'BROWSE'] });
  });

  it('reset posts to /me/settings/reset without a body', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, body));

    await settingsApi.reset();

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/api\/v1\/me\/settings\/reset$/);
    expect(request.body).toBeUndefined();
  });
});
