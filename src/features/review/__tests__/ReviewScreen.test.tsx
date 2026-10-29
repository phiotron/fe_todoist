import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import type { Project } from '../../../api/models';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { inboxProject, makeTask, page, taskChange } from '../../../test/m1Fixtures';
import { makeMember, makeSharedProject, makeWorkspace } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { ReviewScreen } from '../ReviewScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-29T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const team = (canReview: boolean, id = 'pt') =>
  ({
    ...makeSharedProject({ id, name: 'Nhóm', access: 'TEAM', joined: true, canManage: false, workspaceId: 'w1' }),
    capabilities: { canEditTasks: canReview, canCompleteTasks: true, canManageSections: canReview, canComment: true, canReview },
  }) as Project;

const binh = makeMember({ userId: 'u-binh', displayName: 'Bình', role: 'MEMBER' });
const t1 = makeTask({ id: 't1', projectId: 'pt', content: 'Làm báo cáo', reviewStatus: 'PENDING', reviewRequestedBy: 'u-binh', reviewRequestedAt: '2026-10-29T02:30:00Z' });
const t2 = makeTask({ id: 't2', projectId: 'pt', content: 'Gửi hợp đồng', reviewStatus: 'PENDING', reviewRequestedBy: 'u-binh', reviewRequestedAt: '2026-10-28T02:30:00Z' });

// a task of a project where I cannot review ("Bạn yêu cầu"): shown, never selectable
const t3 = makeTask({ id: 't3', projectId: 'pm', content: 'Việc của tôi', reviewStatus: 'PENDING', reviewRequestedBy: 'u-binh', reviewRequestedAt: '2026-10-27T02:30:00Z' });
const RESTORE_BODY = { requestedBy: 'u-binh', requestedAt: '2026-10-29T02:30:00Z' };
const ok = (task: typeof t1, extra = {}) => () => jsonResponse(200, taskChange({ ...task, reviewStatus: 'NONE', ...extra }));

function routes(role: 'ADMIN' | 'MEMBER', extra = {}) {
  return {
    'GET /api/v1/tasks': () => jsonResponse(200, page([t1, t2])),
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, team(role === 'ADMIN')]),
    'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ id: 'w1', role })]),
    'GET /api/v1/workspaces/w1/members': () => jsonResponse(200, [binh]),
    'POST /api/v1/tasks/t1/review/approve': () => jsonResponse(200, taskChange({ ...t1, reviewStatus: 'NONE', completedAt: '2026-10-29T03:00:00Z' })),
    'POST /api/v1/tasks/t1/review/reject': () => jsonResponse(200, taskChange({ ...t1, reviewStatus: 'NONE' })),
    'POST /api/v1/tasks/t1/reopen': () => jsonResponse(200, taskChange({ ...t1, reviewStatus: 'NONE' })),
    'POST /api/v1/tasks/t1/review/restore': ok(t1, { reviewStatus: 'PENDING' }),
    'POST /api/v1/tasks/t2/review/approve': ok(t2, { completedAt: '2026-10-29T03:00:00Z' }),
    'POST /api/v1/tasks/t2/review/reject': ok(t2),
    'POST /api/v1/tasks/t2/review/restore': ok(t2, { reviewStatus: 'PENDING' }),
    'POST /api/v1/tasks/t2/reopen': ok(t2),
    ...extra,
  };
}

describe('ReviewScreen — Admin', () => {
  afterEach(() => jest.useRealTimers());

  it('lists the pending tasks with who asked and when, and Duyệt / Trả lại on each', async () => {
    await renderSignedIn(<ReviewScreen />, routes('ADMIN'));
    expect(await screen.findByText('Làm báo cáo')).toBeOnTheScreen();
    expect(screen.getByText('Chờ duyệt')).toBeOnTheScreen();
    expect(await screen.findByText('Bình yêu cầu · 09:30')).toBeOnTheScreen();
    expect(screen.getByText('Bình yêu cầu · 28/10 09:30')).toBeOnTheScreen();
    expect(screen.getByTestId('review-approve-t1')).toBeOnTheScreen();
    expect(screen.getByTestId('review-reject-t2')).toBeOnTheScreen();
  });

  it('Duyệt: POST approve, the row leaves, toast "Đã duyệt" with Undo = reopen', async () => {
    const { fetchMock } = await renderSignedIn(<ReviewScreen />, routes('ADMIN'));
    await screen.findByText('Làm báo cáo');
    await fireEvent.press(screen.getByTestId('review-approve-t1'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/review/approve')).toHaveLength(1));
    expect(await screen.findByText('Đã duyệt')).toBeOnTheScreen();
    expect(screen.queryByTestId('review-row-t1')).toBeNull();
    await fireEvent.press(screen.getByTestId('snackbar-action'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')).toHaveLength(1));
  });

  it('Trả lại: the request is sent AT ONCE (no 5 s wait), the row leaves, toast "Đã trả lại"', async () => {
    const { fetchMock } = await renderSignedIn(<ReviewScreen />, routes('ADMIN'));
    await screen.findByText('Làm báo cáo');
    await fireEvent.press(screen.getByTestId('review-reject-t1'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/review/reject')).toHaveLength(1));
    expect(await screen.findByText('Đã trả lại')).toBeOnTheScreen();
    expect(screen.queryByTestId('review-row-t1')).toBeNull();
  });

  it('Trả lại + Hoàn tác: restore is sent with the ORIGINAL requester and time, after the reject', async () => {
    const { fetchMock } = await renderSignedIn(<ReviewScreen />, routes('ADMIN'));
    await screen.findByText('Làm báo cáo');
    await fireEvent.press(screen.getByTestId('review-reject-t1'));
    await fireEvent.press(await screen.findByTestId('snackbar-action'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/review/restore')).toHaveLength(1));
    const [restore] = requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/review/restore');
    expect(restore.body).toEqual(RESTORE_BODY);
    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls.findIndex((u) => u.endsWith('/t1/review/reject'))).toBeLessThan(calls.findIndex((u) => u.endsWith('/t1/review/restore')));
    expect(await screen.findByTestId('review-row-t1')).toBeOnTheScreen();
  });

  it('Hoàn tác 409 review-not-restorable: "Không thể hoàn tác: việc đã thay đổi"', async () => {
    await renderSignedIn(
      <ReviewScreen />,
      routes('ADMIN', { 'POST /api/v1/tasks/t1/review/restore': () => problem(409, 'Conflict', { code: 'review-not-restorable' }) }),
    );
    await screen.findByText('Làm báo cáo');
    await fireEvent.press(screen.getByTestId('review-reject-t1'));
    await fireEvent.press(await screen.findByTestId('snackbar-action'));
    expect(await screen.findByText('Không thể hoàn tác: việc đã thay đổi')).toBeOnTheScreen();
  });

  it('409 review-not-pending: a clear Vietnamese message (the task was already handled)', async () => {
    await renderSignedIn(
      <ReviewScreen />,
      routes('ADMIN', { 'POST /api/v1/tasks/t1/review/approve': () => problem(409, 'Conflict', { code: 'review-not-pending' }) }),
    );
    await screen.findByText('Làm báo cáo');
    await fireEvent.press(screen.getByTestId('review-approve-t1'));
    expect(await screen.findByText('Công việc này không còn chờ duyệt nữa. Danh sách đã được làm mới.')).toBeOnTheScreen();
  });

  it('empty list', async () => {
    await renderSignedIn(<ReviewScreen />, routes('ADMIN', { 'GET /api/v1/tasks': () => jsonResponse(200, page([])) }));
    expect(await screen.findByText('Không có công việc nào chờ duyệt')).toBeOnTheScreen();
  });
});

const withMine = (role: 'ADMIN' | 'MEMBER', extra = {}) =>
  routes(role, {
    'GET /api/v1/tasks': () => jsonResponse(200, page([t1, t2, t3])),
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, team(role === 'ADMIN'), team(false, 'pm')]),
    ...extra,
  });

describe('ReviewScreen — Admin multi-select', () => {
  async function enterMode(extra = {}) {
    const rendered = await renderSignedIn(<ReviewScreen />, withMine('ADMIN', extra));
    await screen.findByText('Làm báo cáo');
    await fireEvent.press(screen.getByTestId('review-select'));
    return rendered;
  }

  it('the header button "Chọn" enters the mode: bar shows "Đã chọn 0", per-row buttons give way to checkboxes', async () => {
    await enterMode();
    expect(screen.getByTestId('review-selection-bar')).toBeOnTheScreen();
    expect(screen.getByText('Đã chọn 0')).toBeOnTheScreen();
    expect(screen.queryByTestId('review-approve-t1')).toBeNull();
    await fireEvent.press(screen.getByTestId('review-open-t1'));
    expect(screen.getByText('Đã chọn 1')).toBeOnTheScreen();
    expect(screen.getByText('Duyệt (1)')).toBeOnTheScreen();
    expect(screen.getByText('Trả lại (1)')).toBeOnTheScreen();
  });

  it('long press on a row enters the mode with that row ticked; pressing again unticks', async () => {
    await renderSignedIn(<ReviewScreen />, withMine('ADMIN'));
    await screen.findByText('Làm báo cáo');
    await fireEvent(screen.getByTestId('review-open-t2'), 'longPress');
    expect(screen.getByText('Đã chọn 1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('review-open-t2'));
    expect(screen.getByText('Đã chọn 0')).toBeOnTheScreen();
  });

  it('"Chọn tất cả" ticks every reviewable row and skips the ones I cannot review ("Bạn yêu cầu")', async () => {
    await enterMode();
    expect(screen.getByTestId('review-row-t3')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('review-select-all'));
    expect(screen.getByText('Đã chọn 2')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('review-open-t3'));
    expect(screen.getByText('Đã chọn 2')).toBeOnTheScreen();
    expect(screen.queryByTestId('review-check-t3')).toBeNull();
    expect(within(screen.getByTestId('review-row-t1')).getByTestId('review-check-t1')).toBeOnTheScreen();
  });

  it('"Xong" leaves the mode and the per-row buttons come back', async () => {
    await enterMode();
    await fireEvent.press(screen.getByTestId('review-select-done'));
    expect(screen.queryByTestId('review-selection-bar')).toBeNull();
    expect(screen.getByTestId('review-approve-t1')).toBeOnTheScreen();
  });

  it('Duyệt (2): exactly 2 approve requests; toast "Đã duyệt 2 công việc"; Hoàn tác = 2 reopen', async () => {
    const { fetchMock } = await enterMode();
    await fireEvent.press(screen.getByTestId('review-select-all'));
    await fireEvent.press(screen.getByTestId('review-batch-approve'));
    expect(await screen.findByText('Đã duyệt 2 công việc')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/review/approve')).toHaveLength(1);
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t2/review/approve')).toHaveLength(1);
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t3/review/approve')).toHaveLength(0);
    expect(screen.queryByTestId('review-selection-bar')).toBeNull();
    await fireEvent.press(screen.getByTestId('snackbar-action'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')).toHaveLength(1));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t2/reopen')).toHaveLength(1));
  });

  it('Trả lại (2): 2 reject requests; toast "Đã trả lại 2 công việc"; Hoàn tác = 2 restore with each original requester', async () => {
    const { fetchMock } = await enterMode();
    await fireEvent.press(screen.getByTestId('review-select-all'));
    await fireEvent.press(screen.getByTestId('review-batch-reject'));
    expect(await screen.findByText('Đã trả lại 2 công việc')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/review/reject')).toHaveLength(1);
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t2/review/reject')).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('snackbar-action'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t2/review/restore')).toHaveLength(1));
    const [r1] = requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/review/restore');
    const [r2] = requestsTo(fetchMock, 'POST', '/api/v1/tasks/t2/review/restore');
    expect(r1.body).toEqual(RESTORE_BODY);
    expect(r2.body).toEqual({ requestedBy: 'u-binh', requestedAt: '2026-10-28T02:30:00Z' });
  });

  it('a failure on one of the batch brings that row back and the others still go', async () => {
    const { fetchMock } = await enterMode({ 'POST /api/v1/tasks/t1/review/approve': () => problem(409, 'Conflict', { code: 'review-not-pending' }) });
    await fireEvent.press(screen.getByTestId('review-select-all'));
    await fireEvent.press(screen.getByTestId('review-batch-approve'));
    expect(await screen.findByText('Đã duyệt')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t2/review/approve')).toHaveLength(1);
    expect(await screen.findByTestId('review-row-t1')).toBeOnTheScreen();
  });
});

describe('ReviewScreen — Member (read only)', () => {
  it('"Đang chờ duyệt của tôi": the same list without Duyệt / Trả lại', async () => {
    await renderSignedIn(<ReviewScreen />, routes('MEMBER'));
    expect(await screen.findByText('Làm báo cáo')).toBeOnTheScreen();
    expect(screen.getByText('Đang chờ duyệt của tôi')).toBeOnTheScreen();
    expect(screen.queryByTestId('review-approve-t1')).toBeNull();
    expect(screen.queryByTestId('review-reject-t1')).toBeNull();
    expect(screen.queryByTestId('review-select')).toBeNull();
    await fireEvent(screen.getByTestId('review-open-t1'), 'longPress');
    expect(screen.queryByTestId('review-selection-bar')).toBeNull();
    expect(screen.getByText('Quản trị viên nhóm sẽ duyệt hoặc trả lại các công việc này.')).toBeOnTheScreen();
  });
});
