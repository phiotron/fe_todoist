import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { requestsTo, type ApiRoutes, type RoutedRequest } from '../../../test/apiRoutes';
import { testUser } from '../../../test/fixtures';
import { jsonResponse } from '../../../test/http';
import { makeProject, makeTask, page } from '../../../test/m1Fixtures';
import { makeFilter, makeLabel } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { recentSearchesStorageKey } from '../recentSearches';
import { SearchScreen } from '../SearchScreen';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
    // Focus effects run like a mount effect: the cleanup runs when the screen goes away.
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(effect, [effect]);
    },
  };
});

const objects = {
  projects: [makeProject({ id: 'p-1', name: 'Họp quý' })],
  sections: [{ id: 's-1', projectId: 'p-2', projectName: 'Công ty', name: 'Họp tuần' }],
  labels: [makeLabel({ id: 'l-1', name: 'hop' })],
  filters: [makeFilter({ id: 'f-1', name: 'Họp gấp' })],
};

function searchTasks(request: RoutedRequest): Response {
  if (request.query.get('completed') === 'true') {
    return jsonResponse(200, page([makeTask({ id: 't-done', content: 'Họp xong', completedAt: '2026-10-25T03:00:00Z' })]));
  }
  if (request.query.get('cursor') === 'c-1') return jsonResponse(200, page([makeTask({ id: 't-2', content: 'Họp lần 2' })]));
  return jsonResponse(200, page([makeTask({ id: 't-1', content: 'Họp nhóm' })], 'c-1'));
}

const routes: ApiRoutes = {
  'GET /api/v1/search': searchTasks,
  'GET /api/v1/search/objects': () => jsonResponse(200, objects),
};

const stored = () => AsyncStorage.getItem(recentSearchesStorageKey(testUser.id));

describe('SearchScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('shows a hint and calls nothing while empty', async () => {
    const { fetchMock } = await renderSignedIn(<SearchScreen />, routes);
    expect(await screen.findByTestId('search-hint')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('search-input'), '   ');
    expect(screen.getByTestId('search-hint')).toBeTruthy();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/search')).toHaveLength(0);
  });

  it('searches tasks and objects ~300 ms after typing', async () => {
    const { fetchMock } = await renderSignedIn(<SearchScreen />, routes);
    await fireEvent.changeText(screen.getByTestId('search-input'), ' họp ');
    // First render of the results list in this file pays the cold-start cost: wait longer than the 1 s default.

    expect(await screen.findByText('Họp nhóm', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByTestId('search-project-p-1')).toBeTruthy();
    expect(screen.getByTestId('search-section-s-1')).toBeTruthy();
    expect(screen.getByTestId('search-label-l-1')).toBeTruthy();
    expect(screen.getByTestId('search-filter-f-1')).toBeTruthy();

    const taskCalls = requestsTo(fetchMock, 'GET', '/api/v1/search');
    expect(taskCalls).toHaveLength(1);
    expect(taskCalls[0].query.get('q')).toBe('họp');
    expect(taskCalls[0].query.has('completed')).toBe(false);
    expect(requestsTo(fetchMock, 'GET', '/api/v1/search/objects')[0].query.get('q')).toBe('họp');
  });

  it('opens an object, remembering the keyword', async () => {
    await renderSignedIn(<SearchScreen />, routes);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'họp');
    await fireEvent.press(await screen.findByTestId('search-section-s-1'));
    expect(router.push).toHaveBeenCalledWith('/project/p-2');
    await fireEvent.press(screen.getByTestId('search-label-l-1'));
    expect(router.push).toHaveBeenCalledWith('/label/l-1');
    await waitFor(async () => expect(await stored()).toBe(JSON.stringify(['họp'])));
  });

  it('searches completed tasks only when switched on', async () => {
    const { fetchMock } = await renderSignedIn(<SearchScreen />, routes);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'họp');
    await screen.findByText('Họp nhóm');
    await fireEvent.press(screen.getByTestId('search-completed'));

    expect(await screen.findByText('Họp xong')).toBeTruthy();
    expect(screen.queryByTestId('search-project-p-1')).toBeNull();
    const last = requestsTo(fetchMock, 'GET', '/api/v1/search').pop();
    expect(last?.query.get('completed')).toBe('true');
    expect(requestsTo(fetchMock, 'GET', '/api/v1/search/objects')).toHaveLength(1);
  });

  it('loads more task results', async () => {
    const { fetchMock } = await renderSignedIn(<SearchScreen />, routes);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'họp');
    await fireEvent.press(await screen.findByTestId('search-results-load-more'));
    expect(await screen.findByText('Họp lần 2')).toBeTruthy();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/search').pop()?.query.get('cursor')).toBe('c-1');
  });

  it('refuses more than 100 characters at once, without a request', async () => {
    const { fetchMock } = await renderSignedIn(<SearchScreen />, routes);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'a'.repeat(101));
    expect(screen.getByTestId('search-too-long')).toBeTruthy();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/search')).toHaveLength(0);
  });

  it('keeps the 5 latest keywords: submit stores, empty shows them, tapping searches again', async () => {
    await AsyncStorage.setItem(recentSearchesStorageKey(testUser.id), JSON.stringify(['mua sữa']));
    const { fetchMock } = await renderSignedIn(<SearchScreen />, routes);
    expect(await screen.findByText('mua sữa')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('search-input'), 'họp');
    await fireEvent(screen.getByTestId('search-input'), 'submitEditing');
    await fireEvent.press(screen.getByTestId('search-clear'));

    await waitFor(() => expect(screen.getByTestId('search-recent-0')).toBeTruthy());
    expect(screen.getByText('họp')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('search-recent-1'));
    expect(screen.getByTestId('search-input').props.value).toBe('mua sữa');
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET', '/api/v1/search').some((r) => r.query.get('q') === 'mua sữa')).toBe(true),
    );

    await fireEvent.press(screen.getByTestId('search-clear'));
    await fireEvent.press(await screen.findByTestId('search-recent-clear'));
    expect(screen.getByTestId('search-hint')).toBeTruthy();
  });

  it('remembers the keyword when the screen goes away', async () => {
    const { unmount } = await renderSignedIn(<SearchScreen />, routes);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'họp');
    await screen.findByText('Họp nhóm');
    await unmount();
    await waitFor(async () => expect(await stored()).toBe(JSON.stringify(['họp'])));
  });
});
