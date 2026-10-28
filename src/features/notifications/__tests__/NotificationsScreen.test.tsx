import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import vi from '../../../i18n/locales/vi/notifications.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { page } from '../../../test/m1Fixtures';
import { makeNotification } from '../../../test/m8bFixtures';
import { renderSignedIn } from '../../../test/screen';
import { NotificationsScreen } from '../NotificationsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const read = makeNotification({ id: 'n-read', isRead: true, commentExcerpt: 'Đã đọc rồi' });
const fresh = makeNotification({ id: 'n-new', commentExcerpt: '@An xem giúp' });
const onProject = makeNotification({ id: 'n-proj', taskId: null, taskContent: null, commentExcerpt: 'Về dự án' });

function routes(extra: ApiRoutes = {}): ApiRoutes {
  return {
    'GET /api/v1/notifications': (request) =>
      jsonResponse(200, request.query.get('unread') === 'true' ? page([fresh, onProject]) : page([fresh, onProject, read])),
    'GET /api/v1/notifications/unread-count': () => jsonResponse(200, { count: 2 }),
    ...extra,
  };
}

describe('NotificationsScreen', () => {
  it('lists the notifications with the sentence, excerpt and place, unread ones marked', async () => {
    await renderSignedIn(<NotificationsScreen />, routes());

    expect(await screen.findByText('Đã đọc rồi')).toBeOnTheScreen();
    expect(screen.getAllByText(vi.notifications.mention.replace('{{name}}', 'Bình'))).toHaveLength(3);
    expect(screen.getByText('@An xem giúp')).toBeOnTheScreen();
    expect(screen.getByTestId('notification-unread-n-new')).toBeOnTheScreen();
    expect(screen.queryByTestId('notification-unread-n-read')).toBeNull();
    expect(screen.getByTestId('notification-n-new')).toHaveTextContent(/Viết báo cáo · Ra mắt/);
    expect(screen.getByTestId('notification-n-proj')).toHaveTextContent(/Dự án Ra mắt/);
  });

  it('shows the unread count on the tab and loads only unread ones on it', async () => {
    const { fetchMock } = await renderSignedIn(<NotificationsScreen />, routes());
    await screen.findByText('Đã đọc rồi');

    expect(await screen.findByText('Chưa đọc · 2')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('notifications-tabs-unread'));

    await waitFor(() => expect(screen.queryByText('Đã đọc rồi')).toBeNull());
    expect(screen.getByText('@An xem giúp')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/notifications').some((r) => r.query.get('unread') === 'true')).toBe(true);
  });

  it('says so when there is nothing to show', async () => {
    await renderSignedIn(<NotificationsScreen />, {
      'GET /api/v1/notifications': () => jsonResponse(200, page([])),
      'GET /api/v1/notifications/unread-count': () => jsonResponse(200, { count: 0 }),
    });

    expect(await screen.findByText(vi.notifications.emptyAll)).toBeOnTheScreen();
    expect(screen.getByTestId('notifications-mark-all')).toBeDisabled();
  });

  it('marks one as read and opens its task when pressed; a read one is only opened', async () => {
    const { fetchMock } = await renderSignedIn(
      <NotificationsScreen />,
      routes({ 'POST /api/v1/notifications/n-new/read': () => jsonResponse(204) }),
    );
    await screen.findByText('Đã đọc rồi');

    await fireEvent.press(screen.getByTestId('notification-n-new'));
    expect(router.push).toHaveBeenCalledWith('/task/t-1');
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/notifications/n-new/read')).toHaveLength(1));

    await fireEvent.press(screen.getByTestId('notification-n-read'));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/notifications/n-read/read')).toHaveLength(0);
  });

  it('opens the project comments for a notification that is not about a task', async () => {
    await renderSignedIn(<NotificationsScreen />, routes({ 'POST /api/v1/notifications/n-proj/read': () => jsonResponse(204) }));
    await screen.findByText('Đã đọc rồi');

    await fireEvent.press(screen.getByTestId('notification-n-proj'));

    expect(router.push).toHaveBeenCalledWith('/project-comments/p-1');
  });

  it('marks everything as read and refreshes the list and the count', async () => {
    let unread = true;
    const { fetchMock } = await renderSignedIn(
      <NotificationsScreen />,
      routes({
        'GET /api/v1/notifications': () =>
          jsonResponse(200, page(unread ? [fresh, onProject, read] : [{ ...fresh, isRead: true }, { ...onProject, isRead: true }, read])),
        'GET /api/v1/notifications/unread-count': () => jsonResponse(200, { count: unread ? 2 : 0 }),
        'POST /api/v1/notifications/read-all': () => {
          unread = false;
          return jsonResponse(204);
        },
      }),
    );
    await screen.findByText('Đã đọc rồi');

    await fireEvent.press(screen.getByTestId('notifications-mark-all'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/notifications/read-all')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByTestId('notification-unread-n-new')).toBeNull());
    expect(screen.getByText(vi.notifications.tabUnread)).toBeOnTheScreen();
  });

  it('shows an error state with a retry when the inbox cannot be loaded', async () => {
    await renderSignedIn(<NotificationsScreen />, {
      'GET /api/v1/notifications': () => problem(500, 'Server Error'),
      'GET /api/v1/notifications/unread-count': () => jsonResponse(200, { count: 0 }),
    });

    expect(await screen.findByTestId('notifications-state')).toBeOnTheScreen();
  });

  it('loads the next page when the end of the list is reached', async () => {
    const second = makeNotification({ id: 'n-2', commentExcerpt: 'Trang hai' });
    const { fetchMock } = await renderSignedIn(<NotificationsScreen />, {
      'GET /api/v1/notifications': (request) =>
        request.query.get('cursor') === 'c-1' ? jsonResponse(200, page([second])) : jsonResponse(200, page([fresh], 'c-1')),
      'GET /api/v1/notifications/unread-count': () => jsonResponse(200, { count: 2 }),
    });
    await screen.findByText('@An xem giúp');

    await fireEvent(screen.getByTestId('notifications-list'), 'endReached');

    expect(await screen.findByText('Trang hai')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/notifications')).toHaveLength(2);
  });
});
