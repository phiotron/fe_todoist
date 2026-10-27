import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import viProjects from '../../../i18n/locales/vi/projects.json';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeProject } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { ArchivedProjectsScreen } from '../ArchivedProjectsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const archivedAt = '2026-10-01T00:00:00Z';
const old = makeProject({ id: 'a1', name: 'Dự án cũ', archivedAt, activeTaskCount: 4 });
const oldChild = makeProject({ id: 'a2', name: 'Việc con cũ', archivedAt, parentId: 'a1' });

describe('ArchivedProjectsScreen', () => {
  it('lists archived projects as a tree, opens one read-only and restores one', async () => {
    const { fetchMock } = await renderSignedIn(<ArchivedProjectsScreen />, {
      'GET /api/v1/projects': () => jsonResponse(200, [old, oldChild]),
      'POST /api/v1/projects/a1/unarchive': () => jsonResponse(200, { ...old, archivedAt: null }),
    });

    expect(await screen.findByText('Dự án cũ')).toBeOnTheScreen();
    expect(screen.getByTestId('archived-project-a2')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/projects')[0].query.get('archived')).toBe('true');

    await fireEvent.press(screen.getByTestId('archived-project-a1'));
    expect(router.push).toHaveBeenCalledWith('/project/a1');

    await fireEvent.press(screen.getByTestId('archived-restore-a1'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/a1/unarchive')).toHaveLength(1));
  });

  it('says when nothing is archived, and the back button leaves', async () => {
    await renderSignedIn(<ArchivedProjectsScreen />, { 'GET /api/v1/projects': () => jsonResponse(200, []) });
    expect(await screen.findByText(viProjects.projects.archived.empty)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('archived-header-back'));
    expect(router.back).toHaveBeenCalled();
  });
});
