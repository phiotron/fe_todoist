import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { NotificationPrefsResponse } from '../../../api/notificationPrefs';
import { viTranslation as vi } from '../../../i18n';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { renderSignedIn } from '../../../test/screen';
import { NotificationPrefsScreen } from '../NotificationPrefsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const PREFS: NotificationPrefsResponse = {
  reminderPush: false,
  reminderEmail: false,
  morningOverview: false,
  eveningReview: true,
  subscribedEmails: true,
};

const PATH = '/api/v1/me/notification-prefs';

function checked(testID: string): boolean | undefined {
  return screen.getByTestId(testID).props.accessibilityState?.checked;
}

describe('NotificationPrefsScreen (M13c F7)', () => {
  it('shows every switch with the saved value', async () => {
    await renderSignedIn(<NotificationPrefsScreen />, { [`GET ${PATH}`]: () => jsonResponse(200, PREFS) });

    await screen.findByTestId('notification-prefs-morningOverview');
    expect(checked('notification-prefs-morningOverview')).toBe(false);
    expect(checked('notification-prefs-eveningReview')).toBe(true);
    expect(checked('notification-prefs-subscribedEmails')).toBe(true);
    expect(checked('notification-prefs-reminderPush')).toBe(false);
    expect(checked('notification-prefs-reminderEmail')).toBe(false);
    expect(screen.getByText(vi.notificationPrefs.morningOverviewHint)).toBeTruthy();
    expect(screen.getByText(vi.notificationPrefs.reminderPushHint)).toBeTruthy();
    expect(screen.getByText(vi.notificationPrefs.remindersSection)).toBeTruthy();
  });

  it('a toggle flips at once and PATCHes only that field', async () => {
    const { fetchMock } = await renderSignedIn(<NotificationPrefsScreen />, {
      [`GET ${PATH}`]: () => jsonResponse(200, PREFS),
      [`PATCH ${PATH}`]: () => jsonResponse(200, { ...PREFS, morningOverview: true }),
    });

    await fireEvent.press(await screen.findByTestId('notification-prefs-morningOverview'));

    expect(checked('notification-prefs-morningOverview')).toBe(true);
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', PATH)).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', PATH)[0].body).toEqual({ morningOverview: true });
    await waitFor(() => expect(checked('notification-prefs-morningOverview')).toBe(true));
  });

  it('a failed save puts the switch back and shows an error toast', async () => {
    await renderSignedIn(<NotificationPrefsScreen />, {
      [`GET ${PATH}`]: () => jsonResponse(200, PREFS),
      [`PATCH ${PATH}`]: () => problem(500, 'Internal Server Error', { requestId: 'abcdef123456' }),
    });

    await fireEvent.press(await screen.findByTestId('notification-prefs-reminderEmail'));

    await waitFor(() => expect(checked('notification-prefs-reminderEmail')).toBe(false));
    expect(await screen.findByTestId('snackbar')).toBeTruthy();
  });

  it('a failed load shows the error state and "Retry" loads again', async () => {
    let fail = true;
    await renderSignedIn(<NotificationPrefsScreen />, {
      [`GET ${PATH}`]: () => (fail ? problem(503, 'Unavailable') : jsonResponse(200, PREFS)),
    });

    const retry = await screen.findByTestId('notification-prefs-state-action');
    fail = false;
    await fireEvent.press(retry);

    expect(await screen.findByTestId('notification-prefs-morningOverview')).toBeTruthy();
  });

  it('"Send test push" reports how many devices it was sent to', async () => {
    const { fetchMock } = await renderSignedIn(<NotificationPrefsScreen />, {
      [`GET ${PATH}`]: () => jsonResponse(200, PREFS),
      'POST /api/v1/me/push-tokens/test': () => jsonResponse(202, { devices: 2 }),
    });

    await fireEvent.press(await screen.findByTestId('notification-prefs-test-push'));

    expect(await screen.findByText(vi.notificationPrefs.testSent.replace('{{devices}}', '2'))).toBeTruthy();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/me/push-tokens/test')).toHaveLength(1);
  });

  it('"Send test push" explains when no device is registered', async () => {
    await renderSignedIn(<NotificationPrefsScreen />, {
      [`GET ${PATH}`]: () => jsonResponse(200, PREFS),
      'POST /api/v1/me/push-tokens/test': () => jsonResponse(202, { devices: 0 }),
    });

    await fireEvent.press(await screen.findByTestId('notification-prefs-test-push'));

    expect(await screen.findByText(vi.notificationPrefs.testNoDevice)).toBeTruthy();
  });

  it('a failed test push shows an error toast', async () => {
    await renderSignedIn(<NotificationPrefsScreen />, {
      [`GET ${PATH}`]: () => jsonResponse(200, PREFS),
      'POST /api/v1/me/push-tokens/test': () => problem(429, 'Too Many Requests'),
    });

    await fireEvent.press(await screen.findByTestId('notification-prefs-test-push'));

    expect(await screen.findByText(vi.errors.tooManyRequests)).toBeTruthy();
  });
});
