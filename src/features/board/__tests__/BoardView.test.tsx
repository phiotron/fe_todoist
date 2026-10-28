import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import i18n from '../../../i18n';
import type { PagedQuery } from '../../../lib/usePagedList';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { affected, makeTask } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { LONG_PRESS_MS } from '../../dnd/dnd';
import { SelectionScope } from '../../tasks/SelectionScope';
import type { BoardColumn } from '../boardColumns';
import { BoardView, dragTaskIds } from '../BoardView';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const query: PagedQuery = {
  isPending: false,
  isError: false,
  error: null,
  fetchStatus: 'idle',
  isRefetching: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  refetch: jest.fn(),
  fetchNextPage: jest.fn(),
};

const a = makeTask({ id: 'a', content: 'Viết báo cáo', sectionId: null });
const b = makeTask({ id: 'b', content: 'Gọi khách', sectionId: null });
const c = makeTask({ id: 'c', content: 'Họp', sectionId: 's-1' });

function columns(): BoardColumn[] {
  return [
    { key: 'section:none', title: 'Không có section', tasks: [a, b], drop: { kind: 'section', projectId: 'p-1', sectionId: null }, add: { projectId: 'p-1' } },
    { key: 'section:s-1', title: 'Một', tasks: [c], drop: { kind: 'section', projectId: 'p-1', sectionId: 's-1' } },
    { key: 'overdue', title: 'Quá hạn', tasks: [], drop: null },
  ];
}

const routes = { 'POST /api/v1/tasks/batch': () => jsonResponse(200, affected(['a'])) };

describe('BoardView', () => {
  it('draws one column per entry with its cards and add row', async () => {
    await renderSignedIn(<BoardView columns={columns()} query={query} testID="board" />, routes);
    expect(screen.getByTestId('board-column-section:none')).toBeTruthy();
    expect(screen.getByText('Viết báo cáo')).toBeTruthy();
    expect(screen.getByText('Họp')).toBeTruthy();
    expect(screen.getByTestId('board-add-section:none')).toBeTruthy();
    expect(screen.queryByTestId('board-add-section:s-1')).toBeNull();
    expect(screen.getByText('Không có task')).toBeTruthy();
  });

  it('a drop on another section column moves the task with ONE batch request (with an Idempotency-Key)', async () => {
    const { fetchMock } = await renderSignedIn(<BoardView columns={columns()} query={query} />, routes);

    await fireEvent(screen.getByTestId('board-column-section:s-1'), 'drop', { taskIds: ['a'], task: a }, { x: 10, y: 10 });

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')).toHaveLength(1));
    const request = requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')[0];
    expect(request.body).toEqual({ action: 'MOVE', taskIds: ['a'], projectId: 'p-1', sectionId: 's-1' });
    expect(request.headers['Idempotency-Key']).toBeTruthy();
  });

  it('a drop on its own column or on a column without drops sends nothing', async () => {
    const { fetchMock } = await renderSignedIn(<BoardView columns={columns()} query={query} />, routes);
    await fireEvent(screen.getByTestId('board-column-section:none'), 'drop', { taskIds: ['a'], task: a }, { x: 1, y: 1 });
    await fireEvent(screen.getByTestId('board-column-overdue'), 'drop', { taskIds: ['a'], task: a }, { x: 1, y: 1 });
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')).toHaveLength(0);
  });

  it('shows a failed drop as an error toast', async () => {
    await renderSignedIn(<BoardView columns={columns()} query={query} />, {
      'POST /api/v1/tasks/batch': () => problem(403, 'Forbidden'),
    });
    await fireEvent(screen.getByTestId('board-column-section:s-1'), 'drop', { taskIds: ['a'], task: a }, { x: 1, y: 1 });
    expect(await screen.findByText(i18n.t('errors.forbidden'))).toBeTruthy();
  });

  it('tap opens the task; a long press picks the card up (ghost shown) and a release outside drops nothing', async () => {
    const { fetchMock } = await renderSignedIn(<BoardView columns={columns()} query={query} />, routes);
    const card = screen.getByTestId('board-card-a');
    const at = { nativeEvent: { pageX: 5, pageY: 5 } };

    await fireEvent(card, 'responderGrant', at);
    await fireEvent(card, 'responderRelease', at);
    expect(router.push).toHaveBeenCalledWith('/task/a');

    await fireEvent(card, 'responderGrant', at);
    expect(await screen.findByTestId('drag-ghost')).toBeTruthy();
    await fireEvent(card, 'responderMove', { nativeEvent: { pageX: 400, pageY: 40 } });
    await fireEvent(card, 'responderRelease', { nativeEvent: { pageX: 400, pageY: 40 } });
    await waitFor(() => expect(screen.queryByTestId('drag-ghost')).toBeNull());
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')).toHaveLength(0);
  });

  it('a sub-task card cannot be picked up', async () => {
    const child = makeTask({ id: 'child', parentId: 'a', content: 'Con' });
    await renderSignedIn(<BoardView columns={[{ key: 'all', title: '', tasks: [child], drop: null }]} query={query} />, routes);
    const card = screen.getByTestId('board-card-child');
    await fireEvent(card, 'responderGrant', { nativeEvent: { pageX: 1, pageY: 1 } });
    await new Promise((resolve) => setTimeout(resolve, LONG_PRESS_MS + 50));
    expect(screen.queryByTestId('drag-ghost')).toBeNull();
    await fireEvent(card, 'responderRelease', { nativeEvent: { pageX: 1, pageY: 1 } });
  });
  it('in selection mode a selected card carries the whole (draggable) selection', () => {
    const selection = { active: true, ids: new Set(['a', 'c', 'child']) };
    const all = [a, c, makeTask({ id: 'child', parentId: 'a' })];
    expect(dragTaskIds(a, selection, all)).toEqual(['a', 'c']);
    expect(dragTaskIds(b, selection, all)).toEqual(['b']);
    expect(dragTaskIds(a, null, all)).toEqual(['a']);
  });

  it('tapping a card in selection mode toggles it', async () => {
    await renderSignedIn(
      <SelectionScope>
        <BoardView columns={columns()} query={query} />
      </SelectionScope>,
      routes,
    );
    // No selection yet: tap opens.
    await fireEvent(screen.getByTestId('board-card-b'), 'responderGrant', { nativeEvent: { pageX: 1, pageY: 1 } });
    await fireEvent(screen.getByTestId('board-card-b'), 'responderRelease', { nativeEvent: { pageX: 1, pageY: 1 } });
    expect(router.push).toHaveBeenCalledWith('/task/b');
  });
});
