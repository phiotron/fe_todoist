import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { StartPageSection } from '../StartPageSection';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const TARGETS = {
  'GET /api/v1/projects': () => jsonResponse(200, [{ id: P1, name: 'Marketing', isInbox: false, archivedAt: null }]),
  'GET /api/v1/labels': () => jsonResponse(200, []),
  'GET /api/v1/filters': () => jsonResponse(200, []),
};

describe('StartPageSection', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows the current start page (Today by default)', async () => {
    serveSettings(mockFetch(), { routes: TARGETS });
    await renderWithSettings(<StartPageSection />);

    expect((await screen.findByTestId('start-page')).props.accessibilityLabel).toBe(
      `${vi.settings.startPage.title}, ${vi.settings.targets.TODAY}`,
    );
  });

  it('choosing Upcoming saves only the start page', async () => {
    const { patchBodies } = serveSettings(mockFetch(), { routes: TARGETS });
    await renderWithSettings(<StartPageSection />);

    await fireEvent.press(await screen.findByTestId('start-page'));
    await fireEvent.press(screen.getByTestId('start-page-option-UPCOMING'));

    await waitFor(() => expect(patchBodies).toEqual([{ startPage: 'UPCOMING' }]));
  });

  it('choosing "a project, label or filter" opens the picker and saves the chosen one', async () => {
    const { patchBodies } = serveSettings(mockFetch(), { routes: TARGETS });
    await renderWithSettings(<StartPageSection />);

    await fireEvent.press(await screen.findByTestId('start-page'));
    await fireEvent.press(screen.getByTestId('start-page-option-PICK'));
    await fireEvent.press(await screen.findByTestId(`target-picker-project-${P1}`));

    await waitFor(() => expect(patchBodies).toEqual([{ startPage: `project:${P1}` }]));
  });

  it('a project the server cannot read any more (400 errors[]) keeps the old start page and shows the reason', async () => {
    serveSettings(mockFetch(), {
      routes: TARGETS,
      patch: () => problem(400, 'Bad Request', { errors: [{ field: 'startPage', message: 'Mục không đọc được' }] }),
    });
    await renderWithSettings(<StartPageSection />);

    await fireEvent.press(await screen.findByTestId('start-page'));
    await fireEvent.press(screen.getByTestId('start-page-option-PICK'));
    await fireEvent.press(await screen.findByTestId(`target-picker-project-${P1}`));

    expect((await screen.findByTestId('start-page-error')).props.children).toBe('Mục không đọc được');
    expect(screen.getByTestId('start-page').props.accessibilityLabel).toBe(
      `${vi.settings.startPage.title}, ${vi.settings.targets.TODAY}`,
    );
  });

  it('shows the name of a pinned start page, or "no longer exists" when it is gone', async () => {
    serveSettings(mockFetch(), { settings: settingsResponse({ startPage: `project:${P1}` }), routes: TARGETS });
    const first = await renderWithSettings(<StartPageSection />);
    await waitFor(() => expect(screen.getByTestId('start-page').props.accessibilityLabel).toContain('Marketing'));
    first.unmount();

    serveSettings(mockFetch(), { settings: settingsResponse({ startPage: `project:${P2}` }), routes: TARGETS });
    await renderWithSettings(<StartPageSection />);
    await waitFor(() =>
      expect(screen.getByTestId('start-page').props.accessibilityLabel).toContain(vi.settings.startPage.unknown),
    );
  });
});
