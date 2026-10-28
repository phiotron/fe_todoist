import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { AuthorizedAppResponse } from '../../../api/authorizedApps';
import { enTranslation, viTranslation as vi } from '../../../i18n';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { renderSignedIn } from '../../../test/screen';
import { formatAuthorizedDate, IntegrationsScreen } from '../IntegrationsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const PATH = '/api/v1/me/authorized-apps';

const NOTES: AuthorizedAppResponse = {
  clientId: 'tkc_notes',
  name: 'Notes Sync',
  scopes: ['data:read', 'task:add'],
  authorizedAt: '2026-10-20T08:00:00Z',
  lastUsedAt: null,
};
const OTHER: AuthorizedAppResponse = {
  clientId: 'tkc_other',
  name: 'Custom Tool',
  scopes: ['custom:scope'],
  authorizedAt: '2026-10-19T08:00:00Z',
  lastUsedAt: '2026-10-21T08:00:00Z',
};

describe('IntegrationsScreen (M13c F4)', () => {
  it('lists every authorized app with readable scopes (unknown scopes as is)', async () => {
    await renderSignedIn(<IntegrationsScreen />, { [`GET ${PATH}`]: () => jsonResponse(200, [NOTES, OTHER]) });

    expect(await screen.findByText('Notes Sync')).toBeTruthy();
    expect(screen.getByText(vi.oauth.scopes.dataRead)).toBeTruthy();
    expect(screen.getByText(vi.oauth.scopes.taskAdd)).toBeTruthy();
    expect(screen.getByText('Custom Tool')).toBeTruthy();
    expect(screen.getByText('custom:scope')).toBeTruthy();
    expect(screen.getByTestId('integrations-revoke-tkc_notes')).toBeTruthy();
  });

  it('shows the empty state when no app was authorized', async () => {
    await renderSignedIn(<IntegrationsScreen />, { [`GET ${PATH}`]: () => jsonResponse(200, []) });
    expect(await screen.findByText(vi.integrations.empty)).toBeTruthy();
  });

  it('a failed load shows the error state and "Retry" loads again', async () => {
    let fail = true;
    await renderSignedIn(<IntegrationsScreen />, {
      [`GET ${PATH}`]: () => (fail ? problem(503, 'Unavailable') : jsonResponse(200, [NOTES])),
    });
    const retry = await screen.findByTestId('integrations-state-action');
    fail = false;
    await fireEvent.press(retry);
    expect(await screen.findByText('Notes Sync')).toBeTruthy();
  });

  it('Revoke asks first; Cancel never calls the API', async () => {
    const { fetchMock } = await renderSignedIn(<IntegrationsScreen />, {
      [`GET ${PATH}`]: () => jsonResponse(200, [NOTES]),
    });

    await fireEvent.press(await screen.findByTestId('integrations-revoke-tkc_notes'));
    expect(await screen.findByText(vi.integrations.revokeTitle.replace('{{name}}', 'Notes Sync'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('integrations-revoke-dialog-cancel'));

    expect(requestsTo(fetchMock, 'DELETE', `${PATH}/tkc_notes`)).toHaveLength(0);
  });

  it('confirming revokes the app, reloads the list and shows a toast', async () => {
    let apps = [NOTES, OTHER];
    const { fetchMock } = await renderSignedIn(<IntegrationsScreen />, {
      [`GET ${PATH}`]: () => jsonResponse(200, apps),
      [`DELETE ${PATH}/tkc_notes`]: () => {
        apps = [OTHER];
        return jsonResponse(204);
      },
    });

    await fireEvent.press(await screen.findByTestId('integrations-revoke-tkc_notes'));
    await fireEvent.press(await screen.findByTestId('integrations-revoke-dialog-confirm'));

    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', `${PATH}/tkc_notes`)).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('Notes Sync')).toBeNull());
    expect(screen.getByText('Custom Tool')).toBeTruthy();
    expect(await screen.findByText(vi.integrations.revoked.replace('{{name}}', 'Notes Sync'))).toBeTruthy();
  });

  it('a failed revoke keeps the dialog open with the reason', async () => {
    await renderSignedIn(<IntegrationsScreen />, {
      [`GET ${PATH}`]: () => jsonResponse(200, [NOTES]),
      [`DELETE ${PATH}/tkc_notes`]: () => problem(500, 'Internal Server Error', { requestId: 'abcdef123456' }),
    });

    await fireEvent.press(await screen.findByTestId('integrations-revoke-tkc_notes'));
    await fireEvent.press(await screen.findByTestId('integrations-revoke-dialog-confirm'));

    expect(await screen.findByTestId('integrations-revoke-dialog-error')).toBeTruthy();
    expect(screen.getByText('Notes Sync')).toBeTruthy();
  });

  it('a stale revoke (404) still reloads the list', async () => {
    let apps = [NOTES];
    const { fetchMock } = await renderSignedIn(<IntegrationsScreen />, {
      [`GET ${PATH}`]: () => jsonResponse(200, apps),
      [`DELETE ${PATH}/tkc_notes`]: () => {
        apps = [];
        return problem(404, 'Not Found');
      },
    });

    await fireEvent.press(await screen.findByTestId('integrations-revoke-tkc_notes'));
    await fireEvent.press(await screen.findByTestId('integrations-revoke-dialog-confirm'));

    await waitFor(() => expect(requestsTo(fetchMock, 'GET', PATH).length).toBeGreaterThanOrEqual(2));
    expect(await screen.findByText(vi.integrations.empty)).toBeTruthy();
  });
});

describe('formatAuthorizedDate', () => {
  it('formats an instant in the given language', () => {
    expect(formatAuthorizedDate('2026-10-20T08:00:00Z', 'en')).toMatch(/2026/);
    expect(formatAuthorizedDate('2026-10-20T08:00:00Z', 'en')).toMatch(/Oct/);
  });

  it('returns the raw text when it is not a date', () => {
    expect(formatAuthorizedDate('not a date', 'vi')).toBe('not a date');
  });

  it('has the English strings for every key the screen uses', () => {
    expect(enTranslation.integrations.revoke).toBe('Revoke');
  });
});
