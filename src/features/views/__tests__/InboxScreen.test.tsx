import { fireEvent, screen } from '@testing-library/react-native';
import viCommon from '../../../i18n/locales/vi/common.json';
import vi from '../../../i18n/locales/vi.json';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeTask, page } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { InboxScreen } from '../InboxScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

describe('InboxScreen', () => {
  it('waits for the projects list to learn the Inbox id, then shows the Inbox as a project screen (tasks?projectId=)', async () => {
    const { fetchMock } = await renderSignedIn(<InboxScreen />, {
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject]),
      'GET /api/v1/projects/p-inbox': () => jsonResponse(200, { ...inboxProject, activeTaskCount: 1 }),
      'GET /api/v1/projects/p-inbox/sections': () => jsonResponse(200, []),
      'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 'i1', content: 'Việc trong Inbox' })])),
      ...viewOptionsRoutes(['project:p-inbox']),
    });

    expect(await screen.findByText('Việc trong Inbox')).toBeOnTheScreen();
    const request = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.includes('/api/v1/tasks'));
    expect(request).toContain('projectId=p-inbox');
  });

  it('shows an error with a retry (not a blank screen) when the projects list answers without an Inbox', async () => {
    let calls = 0;
    await renderSignedIn(<InboxScreen />, {
      'GET /api/v1/projects': () => {
        calls += 1;
        return jsonResponse(200, calls === 1 ? [] : [inboxProject]);
      },
      'GET /api/v1/projects/p-inbox': () => jsonResponse(200, inboxProject),
      'GET /api/v1/projects/p-inbox/sections': () => jsonResponse(200, []),
      'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 'i1', content: 'Việc trong Inbox' })])),
      ...viewOptionsRoutes(['project:p-inbox']),
    });

    expect(await screen.findByText(vi.errors.unknown)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText(viCommon.common.retry));

    expect(await screen.findByText('Việc trong Inbox')).toBeOnTheScreen();
  });
});
