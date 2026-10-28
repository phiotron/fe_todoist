import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import vi from '../../../i18n/locales/vi/notifications.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../../test/m8bFixtures';
import { renderSignedIn } from '../../../test/screen';
import { NotificationBell } from '../NotificationBell';
import { NotificationSettingsScreen } from '../NotificationSettingsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

function settingsRoutes(extra: ApiRoutes = {}): ApiRoutes {
  let items = DEFAULT_NOTIFICATION_SETTINGS;
  return {
    'GET /api/v1/me/notification-settings': () => jsonResponse(200, { items }),
    'PUT /api/v1/me/notification-settings': (request) => {
      const sent = (request.body as { items: typeof items }).items;
      items = items.map((item) => sent.find((s) => s.event === item.event) ?? item);
      return jsonResponse(200, { items });
    },
    ...extra,
  };
}

describe('NotificationSettingsScreen', () => {
  it('lists the Project and Workspace switches, all on by default', async () => {
    await renderSignedIn(<NotificationSettingsScreen />, settingsRoutes());

    expect(await screen.findByText(vi.notifications.settings.projectTitle)).toBeOnTheScreen();
    expect(screen.getByText(vi.notifications.settings.workspaceTitle)).toBeOnTheScreen();
    for (const item of DEFAULT_NOTIFICATION_SETTINGS) {
      expect(screen.getByTestId(`notification-setting-${item.event}`).props.accessibilityState.checked).toBe(true);
    }
    // only the mention switch has an effect today; the others say so
    expect(screen.getAllByText(vi.notifications.settings.notYet)).toHaveLength(5);
  });

  it('saves a switch with PUT and shows the saved value', async () => {
    const { fetchMock } = await renderSignedIn(<NotificationSettingsScreen />, settingsRoutes());
    await screen.findByTestId('notification-setting-COMMENT_MENTION');

    await fireEvent.press(screen.getByTestId('notification-setting-COMMENT_MENTION'));

    await waitFor(() => expect(requestsTo(fetchMock, 'PUT', '/api/v1/me/notification-settings')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/me/notification-settings')[0].body).toEqual({
      items: [{ scope: 'PROJECT', event: 'COMMENT_MENTION', enabled: false }],
    });
    await waitFor(() =>
      expect(screen.getByTestId('notification-setting-COMMENT_MENTION').props.accessibilityState.checked).toBe(false),
    );
  });

  it('keeps the old value and says so when saving fails', async () => {
    await renderSignedIn(
      <NotificationSettingsScreen />,
      settingsRoutes({ 'PUT /api/v1/me/notification-settings': () => problem(500, 'Server Error') }),
    );
    await screen.findByTestId('notification-setting-COMMENT_ADDED');

    await fireEvent.press(screen.getByTestId('notification-setting-COMMENT_ADDED'));

    expect(await screen.findByText(vi.notifications.settings.saveFailed)).toBeOnTheScreen();
    expect(screen.getByTestId('notification-setting-COMMENT_ADDED').props.accessibilityState.checked).toBe(true);
  });
});

describe('NotificationBell', () => {
  it('shows a badge with the unread count and opens the inbox', async () => {
    await renderSignedIn(<NotificationBell />, { 'GET /api/v1/notifications/unread-count': () => jsonResponse(200, { count: 3 }) });

    expect(await screen.findByTestId('browse-notifications-badge')).toHaveTextContent('3');
    expect(screen.getByLabelText(vi.notifications.openWithUnread.replace('{{n}}', '3'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('browse-notifications'));
    expect(router.push).toHaveBeenCalledWith('/notifications');
  });

  it('has no badge when everything is read', async () => {
    await renderSignedIn(<NotificationBell />, {
      'GET /api/v1/notifications/unread-count': () => jsonResponse(200, { count: 0 }),
    });
    await waitFor(() => expect(screen.getByLabelText(vi.notifications.open)).toBeOnTheScreen());
    expect(screen.queryByTestId('browse-notifications-badge')).toBeNull();
  });

  it('shows 99+ for a large count', async () => {
    await renderSignedIn(<NotificationBell />, { 'GET /api/v1/notifications/unread-count': () => jsonResponse(200, { count: 250 }) });

    expect(await screen.findByTestId('browse-notifications-badge')).toHaveTextContent('99+');
  });
});
