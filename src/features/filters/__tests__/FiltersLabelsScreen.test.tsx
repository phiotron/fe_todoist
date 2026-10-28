import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeFilter, makeLabel } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { ThemeProvider, layout, lightPalette, paletteFor, size } from '../../../theme';
import { FiltersLabelsScreen } from '../FiltersLabelsScreen';

/** RNTL 14 host element (host views only: View, Text, ScrollView…). */
type HostNode = ReturnType<typeof screen.getByTestId>;

function flatStyle(node: HostNode) {
  return StyleSheet.flatten(node.props.style) ?? {};
}

/** First background colour on the views from the row up to (not including) the swipe wrapper. */
function rowBackground(row: HostNode, swipe: HostNode): unknown {
  let node: HostNode | null = row;
  while (node && node !== swipe) {
    if (flatStyle(node).backgroundColor) return flatStyle(node).backgroundColor;
    node = node.parent;
  }
  return undefined;
}

function descendants(node: HostNode): HostNode[] {
  return node.children.flatMap((child) => (typeof child === 'string' ? [] : [child, ...descendants(child)]));
}

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

describe('FiltersLabelsScreen task counts (design M-Filters, as Todoist)', () => {
  const counts: ApiRoutes = {
    'GET /api/v1/labels/counts': () =>
      jsonResponse(200, [
        { labelId: 'l-1', taskCount: 5 },
        { labelId: 'l-2', taskCount: 0 },
      ]),
    'GET /api/v1/filters/counts': () => jsonResponse(200, [{ filterId: 'f-1', taskCount: 12 }]),
  };

  it('shows the open-task count at the right of each row and hides a zero', async () => {
    await open(counts);
    expect((await screen.findByTestId('fl-label-l-1-count')).props.children).toBe('5');
    expect((await screen.findByTestId('fl-filter-f-1-count')).props.children).toBe('12');
    expect(screen.queryByTestId('fl-label-l-2-count')).toBeNull();
    // the favourite heart and the count share the right side
    expect(screen.getByTestId('fl-label-l-2-favorite')).toBeTruthy();
  });

  it('keeps the rows (without numbers) when the counts cannot be loaded', async () => {
    await open({
      'GET /api/v1/labels/counts': () => jsonResponse(500, {}),
      'GET /api/v1/filters/counts': () => jsonResponse(500, {}),
    });
    expect(await screen.findByTestId('fl-label-l-1')).toBeTruthy();
    expect(screen.queryByTestId('fl-label-l-1-count')).toBeNull();
    expect(screen.queryByTestId('fl-filter-f-1-count')).toBeNull();
  });

  // PERF × FL: useDataMutation refreshes only the roots a write can change (lib/sync/invalidation.ts). The counts live
  // under ['tasks'], so a write touching tasks (task, label delete / rename, filter edit) refreshes them; a favorite
  // cannot change any count and leaves them alone.
  it('refreshes the counts after a write that can change them (label delete), not after a favorite', async () => {
    const { fetchMock } = await open({
      ...counts,
      'PUT /api/v1/labels/l-1/favorite': () => jsonResponse(200, { ...labels[0], isFavorite: true }),
      'DELETE /api/v1/labels/l-1': () => jsonResponse(204),
    });
    await screen.findByTestId('fl-label-l-1-count');
    const countRequests = () => requestsTo(fetchMock, 'GET', '/api/v1/labels/counts').length;
    const before = countRequests();

    await fireEvent(screen.getByTestId('fl-label-l-1'), 'longPress');
    await fireEvent.press(screen.getByTestId('fl-actions-favorite'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PUT', '/api/v1/labels/l-1/favorite')).toHaveLength(1));
    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/labels')).not.toHaveLength(1)); // labels refetched
    expect(countRequests()).toBe(before);

    await fireEvent(screen.getByTestId('fl-label-l-1'), 'longPress');
    await fireEvent.press(screen.getByTestId('fl-actions-delete'));
    await fireEvent.press(screen.getByTestId('fl-delete-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/labels/l-1')).toHaveLength(1));
    await waitFor(() => expect(countRequests()).toBeGreaterThan(before));
  });
});

describe('FiltersLabelsScreen layout (no overlapping on a phone)', () => {
  // The swipe's heart action is drawn with absoluteFill under the row; a see-through row shows it on top of the icon + name.
  it('paints every row opaque over the swipe action (light)', async () => {
    await open();
    for (const prefix of ['fl-filter-f-1', 'fl-label-l-1', 'fl-label-l-2']) {
      const row = await screen.findByTestId(prefix);
      expect(rowBackground(row, screen.getByTestId(`${prefix}-swipe`))).toBe(lightPalette.bg);
    }
  });

  it('paints the rows with the dark background in dark mode', async () => {
    await renderSignedIn(
      <ThemeProvider theme="TASKLY" appearance="DARK">
        <FiltersLabelsScreen />
      </ThemeProvider>,
      {
        'GET /api/v1/labels': () => jsonResponse(200, labels),
        'GET /api/v1/filters': () => jsonResponse(200, filters),
      },
    );
    const row = await screen.findByTestId('fl-label-l-1');
    expect(rowBackground(row, screen.getByTestId('fl-label-l-1-swipe'))).toBe(paletteFor('TASKLY', 'dark').bg);
  });

  it('leaves room under the last row for the floating + button (any placement)', async () => {
    await open();
    await screen.findByTestId('fl-label-l-2');
    const content = StyleSheet.flatten(screen.getByTestId('fl-scroll').props.contentContainerStyle);
    expect(content.paddingBottom).toBeGreaterThanOrEqual(layout.fabBottom + size.fab);
  });

  it('positions nothing absolutely inside the list', async () => {
    await open();
    await screen.findByTestId('fl-label-l-2');
    const nodes = descendants(screen.getByTestId('fl-scroll'));
    expect(nodes.length).toBeGreaterThan(5);
    expect(nodes.filter((node) => flatStyle(node).position === 'absolute')).toHaveLength(0);
  });

  it('cuts a long name to one line instead of pushing the favourite mark off the row', async () => {
    const long = 'Việc cần làm gấp cho khách hàng lớn ở Thành phố Hồ Chí Minh tuần này';
    await open({}, { labels: [makeLabel({ id: 'l-9', name: long, isFavorite: true })], filters });
    const text = await screen.findByText(long);
    expect(text.props.numberOfLines).toBe(1);
    const style = flatStyle(text);
    expect(style.flex === 1 || style.flexShrink === 1).toBe(true);
    expect(screen.getByTestId('fl-label-l-9-favorite')).toBeTruthy();
  });

  it('separates the Labels block from the Filters block (design: 24 above Labels)', async () => {
    await open();
    await screen.findByTestId('fl-labels-header');
    const block = screen.getByTestId('fl-labels');
    expect(flatStyle(block).marginTop ?? 0).toBeGreaterThanOrEqual(16);
  });
});
