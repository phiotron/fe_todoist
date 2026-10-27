import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import viQuickAdd from '../../../i18n/locales/vi/quickAdd.json';
import viTaskList from '../../../i18n/locales/vi/taskList.json';
import vi from '../../../i18n/locales/vi.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { inboxProject, makeProject, makeSection, makeTask } from '../../../test/m1Fixtures';
import { goOffline, goOnline } from '../../../test/network';
import { renderSignedIn } from '../../../test/screen';
import { palette } from '../../../theme';
import { QuickAddSheet } from '../QuickAddSheet';
import type { QuickAddParams } from '../quickAddTarget';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

function routes(create: ApiRoutes[string] = () => jsonResponse(201, makeTask())): ApiRoutes {
  return {
    'GET /api/v1/projects': () =>
      jsonResponse(200, [inboxProject, makeProject({ id: 'p1', name: 'Công ty' })]),
    'GET /api/v1/projects/p1/sections': () =>
      jsonResponse(200, [makeSection({ id: 's1', projectId: 'p1', name: 'Việc gấp' })]),
    'GET /api/v1/projects/p-inbox/sections': () => jsonResponse(200, []),
    'POST /api/v1/tasks': create,
  };
}

async function open(params: QuickAddParams = {}, create?: ApiRoutes[string]) {
  const rendered = await renderSignedIn(<QuickAddSheet params={params} />, routes(create));
  await screen.findByText('Inbox'); // the project chip resolves the Inbox name
  return rendered;
}

async function typeName(text: string) {
  await fireEvent.changeText(screen.getByTestId('quick-add-name'), text);
}

describe('QuickAddSheet', () => {
  afterEach(() => goOnline());

  it('adds to the Inbox with the default priority; the sheet stays open, the name empties, a notice shows', async () => {
    const { fetchMock } = await open();

    await typeName('  Mua sữa ');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')).toHaveLength(1));
    const request = requestsTo(fetchMock, 'POST', '/api/v1/tasks')[0];
    // No afterId (absent = end of the block) and no client id (optional, M9): the body is exactly this.
    expect(request.body).toEqual({ projectId: 'p-inbox', content: 'Mua sữa', priority: 4 });
    expect(request.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(screen.getByTestId('quick-add-name').props.value).toBe(''));
    expect(screen.getByTestId('quick-add-notice')).toHaveTextContent(viQuickAdd.quickAdd.added.replace('{{name}}', 'Inbox'));
    expect(router.back).not.toHaveBeenCalled();
  });

  it('starts from the context: due today (Today tab) shows in the date chip and is sent', async () => {
    const { fetchMock } = await open({ dueDate: '2026-10-23' });
    expect(screen.getByTestId('quick-add-date')).toHaveTextContent(/Hôm nay/);
    expect(StyleSheet.flatten(screen.getByText('Hôm nay').props.style)).toMatchObject({ color: palette.ok });

    await typeName('Gọi điện');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')[0].body).toMatchObject({ dueDate: '2026-10-23' });
  });

  it('picks a date with the schedule sheet and a priority from the menu; chips stay for the next task', async () => {
    const { fetchMock } = await open();
    await fireEvent.press(screen.getByTestId('quick-add-date'));
    await fireEvent.press(await screen.findByTestId('quick-add-schedule-tomorrow'));
    expect(screen.getByTestId('quick-add-date')).toHaveTextContent(/Ngày mai/);
    await fireEvent.press(screen.getByTestId('quick-add-priority'));
    await fireEvent.press(screen.getByTestId('priority-menu-1'));
    expect(screen.getByTestId('quick-add-priority')).toHaveTextContent(/P1/);

    await typeName('Họp');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId('quick-add-name').props.value).toBe(''));
    await typeName('Họp tiếp');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')).toHaveLength(2));

    const [first, second] = requestsTo(fetchMock, 'POST', '/api/v1/tasks');
    expect(first.body).toEqual({ projectId: 'p-inbox', content: 'Họp', priority: 1, dueDate: '2026-10-24' });
    expect(second.body).toMatchObject({ content: 'Họp tiếp', priority: 1, dueDate: '2026-10-24' });
    expect(second.headers['Idempotency-Key']).not.toBe(first.headers['Idempotency-Key']);
  });

  it('chooses the project and section; the chip names both', async () => {
    const { fetchMock } = await open();
    await fireEvent.press(screen.getByTestId('quick-add-project'));
    await fireEvent.press(await screen.findByTestId('quick-add-picker-project-p1'));
    await fireEvent.press(await screen.findByTestId('quick-add-picker-section-s1'));
    expect(await screen.findByText('Công ty · Việc gấp')).toBeOnTheScreen();

    await typeName('Báo cáo');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')[0].body).toMatchObject({ projectId: 'p1', sectionId: 's1' });
  });

  it('adding a sub-task hides the project chip and sends parentId with the parent project and section', async () => {
    const { fetchMock } = await renderSignedIn(
      <QuickAddSheet params={{ parentId: 't1', projectId: 'p1', sectionId: 's1' }} />,
      routes(),
    );
    expect(screen.queryByTestId('quick-add-project')).toBeNull();
    expect(screen.getByTestId('quick-add-name')).toHaveProp('placeholder', viQuickAdd.quickAdd.subtaskPlaceholder);

    await typeName('Bước 1');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')[0].body).toEqual({
      projectId: 'p1',
      sectionId: 's1',
      parentId: 't1',
      content: 'Bước 1',
      priority: 4,
    });
  });

  it('keeps the text after a server error and retries with the SAME Idempotency-Key', async () => {
    let calls = 0;
    const { fetchMock } = await open({}, () => {
      calls += 1;
      return calls === 1
        ? problem(500, 'Internal Server Error', { requestId: '7f3c9a12-aaaa-4bbb-8ccc-dddddddddddd' })
        : jsonResponse(201, makeTask());
    });

    await typeName('Mua sữa');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    expect(await screen.findByText(vi.errors.server.replace('{{code}}', '7f3c9a12'))).toBeOnTheScreen();
    expect(screen.getByTestId('quick-add-name').props.value).toBe('Mua sữa');

    await fireEvent.press(screen.getByTestId('quick-add-submit'));
    await waitFor(() => expect(screen.getByTestId('quick-add-name').props.value).toBe(''));
    const [first, retry] = requestsTo(fetchMock, 'POST', '/api/v1/tasks');
    expect(retry.headers['Idempotency-Key']).toBe(first.headers['Idempotency-Key']);
  });

  it('says why a limit was reached (spec 2.1) and keeps the text', async () => {
    await open({}, () => problem(422, 'Unprocessable', { code: 'limit-reached', limit: 'PROJECT_ACTIVE_TASKS', max: 300 }));
    await typeName('Việc thứ 301');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    expect(await screen.findByText(vi.errors.limit.projectActiveTasks.replace('{{max}}', '300'))).toBeOnTheScreen();
    expect(screen.getByTestId('quick-add-name').props.value).toBe('Việc thứ 301');
  });

  it('a sub-task under a parent that sits in an archived project → 409 project-archived, text kept (spec 12.3 row 4)', async () => {
    await renderSignedIn(
      <QuickAddSheet params={{ parentId: 't1', projectId: 'p1' }} />,
      routes(() => problem(409, 'Conflict', { code: 'project-archived' })),
    );
    await typeName('Bước 1');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    expect(await screen.findByText(vi.errors.projectArchived)).toBeOnTheScreen();
    expect(screen.getByTestId('quick-add-name').props.value).toBe('Bước 1');
  });

  it('a TARGET archived meanwhile → 422 target-archived (not 409), text kept', async () => {
    await open({}, () => problem(422, 'Unprocessable', { code: 'target-archived' }));
    await typeName('Họp');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    expect(await screen.findByText(vi.errors.targetArchived)).toBeOnTheScreen();
    expect(screen.getByTestId('quick-add-name').props.value).toBe('Họp');
  });

  it('validates on the device: blank names cannot be sent, too long names show the message', async () => {
    const { fetchMock } = await open();
    expect(screen.getByTestId('quick-add-submit')).toBeDisabled();

    await typeName('a'.repeat(501));
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    expect(await screen.findByText(viTaskList.taskList.validation.contentTooLong)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks')).toHaveLength(0);
  });

  it('the scrim closes the sheet', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('quick-add-scrim'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('cannot send while offline', async () => {
    goOffline();
    await renderSignedIn(<QuickAddSheet params={{}} />, routes());
    await fireEvent.changeText(screen.getByTestId('quick-add-name'), 'Mua sữa');
    expect(screen.getByTestId('quick-add-submit')).toBeDisabled();
  });
});
