import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ViewOptions } from '../../../api/viewOptions';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeTask, page } from '../../../test/m1Fixtures';
import { makeLabel, makeViewOptions } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { LabelScreen } from '../LabelScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const label = makeLabel({ id: 'l-1', name: 'gap' });
const tasks = [
  makeTask({ id: 't-1', content: 'Mua sữa', priority: 1, labelIds: ['l-1'], projectName: 'Nhà' }),
  makeTask({ id: 't-2', content: 'Gọi điện', priority: 3, labelIds: ['l-1'], projectName: 'Việc' }),
];

async function open(saved: ViewOptions[] = [], extra: ApiRoutes = {}) {
  return renderSignedIn(<LabelScreen labelId="l-1" />, {
    'GET /api/v1/labels': () => jsonResponse(200, [label]),
    'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
    ...viewOptionsRoutes(['label:l-1'], saved),
    ...extra,
  });
}

describe('LabelScreen', () => {
  it('lists the open tasks of the label with the saved Display, fetched once', async () => {
    const { fetchMock } = await open();
    expect(await screen.findByText('Mua sữa')).toBeTruthy();
    const calls = requestsTo(fetchMock, 'GET', '/api/v1/tasks');
    expect(calls).toHaveLength(1);
    expect(Object.fromEntries(calls[0].query)).toEqual({ labelId: 'l-1', sort: 'date', order: 'asc', group: 'none' });
  });

  it('groups as saved', async () => {
    const { fetchMock } = await open([makeViewOptions('label:l-1', { sortBy: 'PRIORITY', groupBy: 'PRIORITY' })]);
    expect(await screen.findByText('Ưu tiên 1')).toBeTruthy();
    expect(screen.getByText('Ưu tiên 3')).toBeTruthy();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks')[0].query.get('group')).toBe('priority');
  });

  it('says when no task carries the label', async () => {
    await open([], { 'GET /api/v1/tasks': () => jsonResponse(200, page([])) });
    expect(await screen.findByTestId('label-tasks-empty')).toBeTruthy();
  });

  it('shows "no longer exists" for an unknown label and goes back', async () => {
    await renderSignedIn(<LabelScreen labelId="gone" />, {
      'GET /api/v1/labels': () => jsonResponse(200, [label]),
      ...viewOptionsRoutes([]),
    });
    expect(await screen.findByTestId('label-not-found')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('label-not-found-back'));
    expect(router.back).toHaveBeenCalled();
  });

  it('opens the Display sheet', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('label-display-button'));
    expect(screen.getByTestId('display')).toBeTruthy();
  });

  it('edits from the menu', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('label-menu-button'));
    await fireEvent.press(screen.getByTestId('label-actions-edit'));
    expect(screen.getByTestId('label-form-name').props.value).toBe('gap');
  });

  it('deletes after confirmation and goes back', async () => {
    const { fetchMock } = await open([], { 'DELETE /api/v1/labels/l-1': () => jsonResponse(204) });
    await fireEvent.press(await screen.findByTestId('label-menu-button'));
    await fireEvent.press(screen.getByTestId('label-actions-delete'));
    await fireEvent.press(screen.getByTestId('label-delete-confirm'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/labels/l-1')).toHaveLength(1);
  });
});
