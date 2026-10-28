import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeTask } from '../../../test/m1Fixtures';
import { makeLabel } from '../../../test/m2Fixtures';
import { nameText, quickAddSettingsRoute } from '../../../test/quickAddFixtures';
import { renderSignedIn } from '../../../test/screen';
import { NO_DUE } from '../../schedule/dueValue';
import { buildCreateBody } from '../buildTask';
import { QuickAddSheet } from '../QuickAddSheet';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const routes: ApiRoutes = {
  ...quickAddSettingsRoute(),
  'GET /api/v1/projects': () => jsonResponse(200, [inboxProject]),
  'GET /api/v1/projects/p-inbox/sections': () => jsonResponse(200, []),
  'GET /api/v1/labels': () => jsonResponse(200, [makeLabel({ id: 'l-1', name: 'gap' })]),
  'POST /api/v1/tasks': () => jsonResponse(201, makeTask({ id: 't-9', content: 'Mua sữa', labelIds: ['l-1'] })),
};

describe('buildCreateBody with labels', () => {
  it('leaves labelIds out when none are chosen and sends the whole set otherwise', () => {
    const base = { content: 'Mua sữa', description: '', priority: 4, due: NO_DUE };
    expect(buildCreateBody(base)).not.toHaveProperty('labelIds');
    expect(buildCreateBody({ ...base, labelIds: [] })).not.toHaveProperty('labelIds');
    expect(buildCreateBody({ ...base, labelIds: ['l-1', 'l-2'] }).labelIds).toEqual(['l-1', 'l-2']);
  });
});

describe('Quick Add Labels chip', () => {
  it('creates the task with the labels picked on the chip and keeps them for the next task', async () => {
    const { fetchMock } = await renderSignedIn(<QuickAddSheet params={{}} />, routes);
    await screen.findByText('Hộp thư đến');

    await fireEvent.press(screen.getByTestId('quick-add-label'));
    await fireEvent.press(await screen.findByTestId('quick-add-label-picker-item-l-1'));
    await fireEvent.press(screen.getByTestId('quick-add-label-picker-action-done'));
    expect(screen.getByTestId('quick-add-label')).toHaveTextContent(/gap/);

    await fireEvent.changeText(screen.getByTestId('quick-add-name'), 'Mua sữa');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')[0].body).toEqual({
      projectId: 'p-inbox',
      content: 'Mua sữa',
      priority: 4,
      labelIds: ['l-1'],
    });
    // Like the date and priority chips, the labels stay for the next task.
    await waitFor(() => expect(nameText()).toBe(''));
    expect(screen.getByTestId('quick-add-label')).toHaveTextContent(/gap/);
  });

  it('sends no labelIds when none were chosen (the M1 body is unchanged)', async () => {
    const { fetchMock } = await renderSignedIn(<QuickAddSheet params={{}} />, routes);
    await screen.findByText('Hộp thư đến');
    await fireEvent.changeText(screen.getByTestId('quick-add-name'), 'Mua sữa');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')[0].body).toEqual({
      projectId: 'p-inbox',
      content: 'Mua sữa',
      priority: 4,
    });
  });
});

