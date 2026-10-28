import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeFilter, makeLabel } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { FiltersLabelsScreen } from '../FiltersLabelsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const labels = [
  makeLabel({ id: 'l-1', name: 'gap', color: 'red', sortOrder: 1 }),
  makeLabel({ id: 'l-2', name: 'nha', sortOrder: 2, isFavorite: true }),
];
const filters = [makeFilter({ id: 'f-1', name: 'Chưa lên lịch', query: 'no date' })];

async function open(extra: ApiRoutes = {}, data = { labels, filters }) {
  return renderSignedIn(<FiltersLabelsScreen />, {
    'GET /api/v1/labels': () => jsonResponse(200, data.labels),
    'GET /api/v1/filters': () => jsonResponse(200, data.filters),
    ...extra,
  });
}

describe('FiltersLabelsScreen (M-Filters)', () => {
  it('lists filters then labels and opens them', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('fl-filter-f-1'));
    expect(router.push).toHaveBeenCalledWith('/filter/f-1');
    await fireEvent.press(screen.getByTestId('fl-label-l-1'));
    expect(router.push).toHaveBeenCalledWith('/label/l-1');
    expect(screen.getByText('Chưa lên lịch')).toBeTruthy();
    expect(screen.getByTestId('fl-label-l-2-favorite')).toBeTruthy();
  });

  it('goes back from the header', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('sub-header-back'));
    expect(router.back).toHaveBeenCalled();
  });

  it('says when a block is empty', async () => {
    await open({}, { labels: [], filters: [] });
    expect(await screen.findByTestId('fl-filters-empty')).toBeTruthy();
    expect(screen.getByTestId('fl-labels-empty')).toBeTruthy();
  });

  it('opens the create sheets from the + buttons', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('fl-labels-add'));
    expect(screen.getByTestId('label-form')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('label-form-cancel'));
    await fireEvent.press(screen.getByTestId('fl-filters-add'));
    expect(screen.getByTestId('filter-form')).toBeTruthy();
  });

  it('toggles favorite from the long-press menu', async () => {
    const { fetchMock } = await open({
      'PUT /api/v1/labels/l-1/favorite': () => jsonResponse(200, { ...labels[0], isFavorite: true }),
    });
    await fireEvent(await screen.findByTestId('fl-label-l-1'), 'longPress');
    await fireEvent.press(screen.getByTestId('fl-actions-favorite'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PUT', '/api/v1/labels/l-1/favorite')).toHaveLength(1));
  });

  it('edits from the menu with the current values', async () => {
    await open();
    await fireEvent(await screen.findByTestId('fl-label-l-1'), 'longPress');
    await fireEvent.press(screen.getByTestId('fl-actions-edit'));
    expect(screen.getByTestId('label-form-name').props.value).toBe('gap');
  });

  it('asks before deleting and sends nothing on cancel (BR-11)', async () => {
    const { fetchMock } = await open({ 'DELETE /api/v1/filters/f-1': () => jsonResponse(204) });
    await fireEvent(await screen.findByTestId('fl-filter-f-1'), 'longPress');
    await fireEvent.press(screen.getByTestId('fl-actions-delete'));
    expect(screen.getByText('Bộ lọc “Chưa lên lịch” sẽ bị xoá. Không hoàn tác được.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fl-delete-cancel'));
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/filters/f-1')).toHaveLength(0);

    await fireEvent(screen.getByTestId('fl-filter-f-1'), 'longPress');
    await fireEvent.press(screen.getByTestId('fl-actions-delete'));
    await fireEvent.press(screen.getByTestId('fl-delete-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/filters/f-1')).toHaveLength(1));
  });

  it('reorders labels with afterId (spec 12.4)', async () => {
    const { fetchMock } = await open({ 'POST /api/v1/reorder': () => jsonResponse(200, {}) });
    await fireEvent(await screen.findByTestId('fl-label-l-1'), 'longPress');
    await fireEvent.press(screen.getByTestId('fl-actions-reorder'));
    await fireEvent.press(screen.getByTestId('fl-reorder-down-l-1'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'LABEL', id: 'l-1', afterId: 'l-2' });
  });
});
