import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import type { RouteHandler } from '../../../test/m3Routes';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { NavigationSettingsScreen } from '../NavigationSettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';

function targetRoutes(projects: unknown[] = [{ id: P1, name: 'Marketing', isInbox: false, archivedAt: null }]): Record<string, RouteHandler> {
  return {
    'GET /api/v1/projects': () => jsonResponse(200, projects),
    'GET /api/v1/labels': () => jsonResponse(200, []),
    'GET /api/v1/filters': () => jsonResponse(200, []),
  };
}

function serveNav(navTabs: string[], extra: { patch?: RouteHandler; projects?: unknown[] } = {}) {
  return serveSettings(mockFetch(), {
    settings: settingsResponse({ navTabs }),
    patch: extra.patch,
    routes: targetRoutes(extra.projects),
  });
}

describe('NavigationSettingsScreen', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('lists the tabs in order; Browse is last and has no controls', async () => {
    serveNav(['INBOX', 'TODAY', 'UPCOMING', 'BROWSE']);
    await renderWithSettings(<NavigationSettingsScreen />);

    expect(await screen.findByTestId('nav-tab-INBOX')).toBeTruthy();
    expect(screen.getByTestId('nav-tab-BROWSE')).toBeTruthy();
    expect(screen.queryByTestId('nav-tab-BROWSE-up')).toBeNull();
    expect(screen.queryByTestId('nav-tab-BROWSE-remove')).toBeNull();
    expect(screen.getByTestId('nav-tab-INBOX-up').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('nav-tab-UPCOMING-down').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('moving a tab up saves the new order (Browse stays last)', async () => {
    const { patchBodies } = serveNav(['INBOX', 'TODAY', 'UPCOMING', 'BROWSE']);
    await renderWithSettings(<NavigationSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('nav-tab-TODAY-up'));

    await waitFor(() => expect(patchBodies).toEqual([{ navTabs: ['TODAY', 'INBOX', 'UPCOMING', 'BROWSE'] }]));
  });

  it('removing a tab saves the list; with 3 tabs left nothing more can be removed', async () => {
    const { patchBodies } = serveNav(['INBOX', 'TODAY', 'UPCOMING', 'BROWSE']);
    await renderWithSettings(<NavigationSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('nav-tab-UPCOMING-remove'));

    await waitFor(() => expect(patchBodies).toEqual([{ navTabs: ['INBOX', 'TODAY', 'BROWSE'] }]));
    await waitFor(() =>
      expect(screen.getByTestId('nav-tab-INBOX-remove').props.accessibilityState).toMatchObject({ disabled: true }),
    );
    expect(screen.getByText(vi.settings.navigation.minimum)).toBeTruthy();
  });

  it('adds Search before Browse; with 5 tabs adding is blocked', async () => {
    const { patchBodies } = serveNav(['INBOX', 'TODAY', 'UPCOMING', 'BROWSE']);
    await renderWithSettings(<NavigationSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('nav-add-SEARCH'));

    await waitFor(() => expect(patchBodies).toEqual([{ navTabs: ['INBOX', 'TODAY', 'UPCOMING', 'SEARCH', 'BROWSE'] }]));
    await waitFor(() =>
      expect(screen.getByTestId('nav-add-FILTERS_LABELS').props.accessibilityState).toMatchObject({ disabled: true }),
    );
    expect(screen.getByText(vi.settings.navigation.full)).toBeTruthy();
  });

  it('pins one project: pick it from the list, it joins the tab bar before Browse', async () => {
    const { patchBodies } = serveNav(['INBOX', 'TODAY', 'UPCOMING', 'BROWSE']);
    await renderWithSettings(<NavigationSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('nav-pin'));
    await fireEvent.press(await screen.findByTestId(`target-picker-project-${P1}`));

    await waitFor(() =>
      expect(patchBodies).toEqual([{ navTabs: ['INBOX', 'TODAY', 'UPCOMING', `project:${P1}`, 'BROWSE'] }]),
    );
    expect(await screen.findByTestId(`nav-tab-project:${P1}`)).toBeTruthy();
    expect(screen.getAllByText('Marketing').length).toBeGreaterThan(0);
  });

  it('a second pin replaces the first, even when the bar is full', async () => {
    const { patchBodies } = serveNav(['INBOX', 'TODAY', 'UPCOMING', `project:${P1}`, 'BROWSE'], {
      projects: [
        { id: P1, name: 'Marketing', isInbox: false, archivedAt: null },
        { id: P2, name: 'Sales', isInbox: false, archivedAt: null },
      ],
    });
    await renderWithSettings(<NavigationSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('nav-pin'));
    await fireEvent.press(await screen.findByTestId(`target-picker-project-${P2}`));

    await waitFor(() =>
      expect(patchBodies).toEqual([{ navTabs: ['INBOX', 'TODAY', 'UPCOMING', `project:${P2}`, 'BROWSE'] }]),
    );
  });

  it('a pinned target that no longer exists is not listed', async () => {
    serveNav(['INBOX', 'TODAY', 'UPCOMING', `project:${P2}`, 'BROWSE'], {
      projects: [{ id: P1, name: 'Marketing', isInbox: false, archivedAt: null }],
    });
    await renderWithSettings(<NavigationSettingsScreen />);

    await waitFor(() => expect(screen.queryByTestId(`nav-tab-project:${P2}`)).toBeNull());
    expect(screen.getByTestId('nav-tab-UPCOMING')).toBeTruthy();
  });

  it('restoring the defaults asks first; Cancel changes nothing, Restore saves the default tabs', async () => {
    const { patchBodies } = serveNav(['TODAY', 'SEARCH', 'BROWSE']);
    await renderWithSettings(<NavigationSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('nav-restore'));
    expect(screen.getByText(vi.settings.navigation.restoreConfirmTitle)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('nav-restore-dialog-cancel'));
    expect(patchBodies).toEqual([]);

    await fireEvent.press(screen.getByTestId('nav-restore'));
    await fireEvent.press(screen.getByTestId('nav-restore-dialog-confirm'));

    await waitFor(() => expect(patchBodies).toEqual([{ navTabs: ['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'] }]));
    await waitFor(() => expect(screen.queryByText(vi.settings.navigation.restoreConfirmTitle)).toBeNull());
  });

  it('keeps the change and explains when saving fails', async () => {
    serveNav(['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'], { patch: () => problem(503, 'Service Unavailable') });
    await renderWithSettings(<NavigationSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('nav-tab-TODAY-up'));

    expect((await screen.findByTestId('navigation-error')).props.children).toBe(vi.settings.saveFailed);
  });

  it('a list the server rejects (400 errors[]: the pinned project cannot be read) shows the reason and keeps the old tab bar', async () => {
    serveNav(['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'], {
      patch: () => problem(400, 'Bad Request', { errors: [{ field: 'navTabs', message: 'Mục ghim không đọc được.' }] }),
    });
    await renderWithSettings(<NavigationSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('nav-pin'));
    await fireEvent.press(await screen.findByTestId(`target-picker-project-${P1}`));

    expect((await screen.findByTestId('navigation-error')).props.children).toBe(
      vi.settings.navigation.rejected.replace('{{reason}}', 'Mục ghim không đọc được.'),
    );
    expect(screen.queryByTestId(`nav-tab-project:${P1}`)).toBeNull();
    expect(screen.getByTestId('nav-tab-UPCOMING')).toBeTruthy();
  });

  it('lists a TEAM tab that the server saved (M8) but never offers to add it', async () => {
    serveNav(['INBOX', 'TODAY', 'TEAM', 'BROWSE']);
    await renderWithSettings(<NavigationSettingsScreen />);

    expect(await screen.findByTestId('nav-tab-TEAM')).toBeTruthy();
    expect(screen.queryByTestId('nav-add-TEAM')).toBeNull();
  });
});
