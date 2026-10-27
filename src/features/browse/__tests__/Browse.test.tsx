import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import viBrowse from '../../../i18n/locales/vi/browse.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeFavorite, makeProject } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { BrowseScreen } from '../BrowseScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const work = makeProject({ id: 'p1', name: 'Công ty', sortOrder: 1024, activeTaskCount: 12 });
const plan = makeProject({ id: 'p1a', name: 'Kế hoạch', parentId: 'p1', sortOrder: 1024, activeTaskCount: 3 });
const home = makeProject({ id: 'p2', name: 'Nhà', sortOrder: 2048, isFavorite: true });
const garden = makeProject({ id: 'p3', name: 'Vườn', sortOrder: 3072, isFavorite: true });

function routes(extra: ApiRoutes = {}): ApiRoutes {
  return {
    'GET /api/v1/projects': () =>
      jsonResponse(200, [{ ...inboxProject, activeTaskCount: 3 }, work, plan, home, garden]),
    'GET /api/v1/favorites': () => jsonResponse(200, [makeFavorite('p3'), makeFavorite('p2')]),
    ...extra,
  };
}

describe('BrowseScreen', () => {
  it('shows the shortcuts with the Inbox count, favorites in the order added, and the project tree', async () => {
    await renderSignedIn(<BrowseScreen />, routes());

    expect(await screen.findByText('Công ty')).toBeOnTheScreen();
    expect(screen.getByText(viBrowse.browse.favorites)).toBeOnTheScreen();
    expect(screen.getByText(viBrowse.browse.myProjects)).toBeOnTheScreen();
    expect(screen.getByTestId('browse-shortcut-inbox')).toHaveTextContent(/3$/);
    const favorites = screen.getAllByTestId(/^favorite-project-p\d$/).map((node) => node.props.testID);
    expect(favorites).toEqual(['favorite-project-p3', 'favorite-project-p2']);
    expect(screen.getByTestId('browse-project-p1a')).toBeOnTheScreen();
    expect(screen.getByText('12')).toBeOnTheScreen();
  });

  it('a parent project collapses and opens its sub-projects', async () => {
    await renderSignedIn(<BrowseScreen />, routes());
    await screen.findByTestId('browse-project-p1a');

    await fireEvent.press(screen.getByTestId('browse-project-toggle-p1'));
    expect(screen.queryByTestId('browse-project-p1a')).toBeNull();

    await fireEvent.press(screen.getByTestId('browse-project-toggle-p1'));
    expect(screen.getByTestId('browse-project-p1a')).toBeOnTheScreen();
  });

  it('opens a project, the Completed screen and the Inbox tab', async () => {
    await renderSignedIn(<BrowseScreen />, routes());
    await screen.findByText('Công ty');

    await fireEvent.press(screen.getByTestId('browse-project-p1'));
    expect(router.push).toHaveBeenCalledWith('/project/p1');
    await fireEvent.press(screen.getByTestId('browse-shortcut-completed'));
    expect(router.push).toHaveBeenCalledWith('/completed');
    await fireEvent.press(screen.getByTestId('browse-shortcut-inbox'));
    expect(router.navigate).toHaveBeenCalledWith('/inbox');
  });

  it('swiping a project right adds it to the favorites; swiping a favorite removes it', async () => {
    const { fetchMock } = await renderSignedIn(
      <BrowseScreen />,
      routes({
        'PUT /api/v1/projects/p1/favorite': () => jsonResponse(200, { ...work, isFavorite: true }),
        'DELETE /api/v1/projects/p2/favorite': () => jsonResponse(200, { ...home, isFavorite: false }),
      }),
    );
    await screen.findByText('Công ty');

    await fireEvent(screen.getByTestId('browse-project-swipe-p1'), 'swipeableOpen', 'left');
    await waitFor(() => expect(requestsTo(fetchMock, 'PUT', '/api/v1/projects/p1/favorite')).toHaveLength(1));

    await fireEvent(screen.getByTestId('favorite-project-swipe-p2'), 'swipeableOpen', 'left');
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/projects/p2/favorite')).toHaveLength(1));
  });

  it('the + button opens the project form; ⋯ offers archived projects and the sort dialog', async () => {
    const { fetchMock } = await renderSignedIn(
      <BrowseScreen />,
      routes({ 'POST /api/v1/reorder': () => jsonResponse(200, { type: 'PROJECT', id: 'p2', sortOrder: 512 }) }),
    );
    await screen.findByText('Công ty');

    await fireEvent.press(screen.getByTestId('browse-add-project'));
    expect(router.push).toHaveBeenCalledWith('/project-form');

    await fireEvent.press(screen.getByTestId('browse-projects-menu-open'));
    await fireEvent.press(screen.getByTestId('browse-projects-menu-archived'));
    expect(router.push).toHaveBeenCalledWith('/projects/archived');

    await fireEvent.press(screen.getByTestId('browse-projects-menu-open'));
    await fireEvent.press(screen.getByTestId('browse-projects-menu-reorder'));
    // Root projects in manual order: Công ty (1024), Nhà (2048), Vườn (3072) → move Nhà up to the top.
    await fireEvent.press(screen.getByTestId('browse-reorder-up-p2'));
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'PROJECT', id: 'p2', afterId: null }),
    );
  });

  it('says how to create the first project when there is none', async () => {
    await renderSignedIn(<BrowseScreen />, {
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject]),
      'GET /api/v1/favorites': () => jsonResponse(200, []),
    });
    expect(await screen.findByText(viBrowse.browse.noProjects)).toBeOnTheScreen();
    expect(screen.queryByText(viBrowse.browse.favorites)).toBeNull();
  });

  it('the avatar opens the account box', async () => {
    await renderSignedIn(<BrowseScreen />, routes());
    await screen.findByText('Công ty');

    await fireEvent.press(screen.getByTestId('browse-account'));

    expect(await screen.findByTestId('account-sign-out')).toBeOnTheScreen();
  });
});
