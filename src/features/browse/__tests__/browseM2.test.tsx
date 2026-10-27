import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject } from '../../../test/m1Fixtures';
import { makeFilter, makeLabel } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { BrowseScreen } from '../BrowseScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const routes = {
  'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, makeProject({ id: 'p-1', name: 'Nhà', isFavorite: true })]),
  'GET /api/v1/favorites': () =>
    jsonResponse(200, [
      { targetType: 'LABEL', targetId: 'l-1', createdAt: '2026-10-20T00:00:00Z' },
      { targetType: 'PROJECT', targetId: 'p-1', createdAt: '2026-10-21T00:00:00Z' },
      { targetType: 'FILTER', targetId: 'f-1', createdAt: '2026-10-22T00:00:00Z' },
    ]),
  'GET /api/v1/labels': () =>
    jsonResponse(200, [makeLabel({ id: 'l-1', name: 'gap', isFavorite: true }), makeLabel({ id: 'l-2', name: 'nha' })]),
  'GET /api/v1/filters': () => jsonResponse(200, [makeFilter({ id: 'f-1', name: 'Gấp', isFavorite: true })]),
};

describe('Browse (M2 parts of M-Browse)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens search from the header and Filters & Labels from the shortcut list', async () => {
    await renderSignedIn(<BrowseScreen />, routes);
    await fireEvent.press(await screen.findByTestId('browse-search'));
    expect(router.push).toHaveBeenCalledWith('/search');
    await fireEvent.press(screen.getByTestId('browse-shortcut-filters-labels'));
    expect(router.push).toHaveBeenCalledWith('/filters-labels');
  });

  it('puts Filters & Labels between Today and Completed (M-Browse)', async () => {
    await renderSignedIn(<BrowseScreen />, routes);
    await screen.findByTestId('browse-shortcut-filters-labels');
    const order = screen.getAllByTestId(/^browse-shortcut-/).map((node) => node.props.testID);
    expect(order).toEqual([
      'browse-shortcut-inbox',
      'browse-shortcut-today',
      'browse-shortcut-filters-labels',
      'browse-shortcut-completed',
    ]);
  });

  it('lists favorite labels and filters with the projects and opens them', async () => {
    await renderSignedIn(<BrowseScreen />, routes);
    await fireEvent.press(await screen.findByTestId('favorite-label-l-1'));
    expect(router.push).toHaveBeenCalledWith('/label/l-1');
    await fireEvent.press(screen.getByTestId('favorite-filter-f-1'));
    expect(router.push).toHaveBeenCalledWith('/filter/f-1');
    expect(screen.getByTestId('favorite-project-p-1')).toBeTruthy();
  });

  it('shows every label as a chip at the bottom', async () => {
    await renderSignedIn(<BrowseScreen />, routes);
    await fireEvent.press(await screen.findByTestId('browse-label-l-2'));
    expect(router.push).toHaveBeenCalledWith('/label/l-2');
  });
});
