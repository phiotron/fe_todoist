import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Project } from '../../../api/models';
import { SNACKBAR_DURATION_MS } from '../../../components/Snackbar';
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

const team = (canReview: boolean) =>
  ({
    ...makeSharedProject({ id: 'pt', name: 'Nhóm', access: 'TEAM', joined: true, canManage: false, workspaceId: 'w1' }),
    capabilities: { canEditTasks: canReview, canCompleteTasks: true, canManageSections: canReview, canComment: true, canReview },
  }) as Project;

const binh = makeMember({ userId: 'u-binh', displayName: 'Bình', role: 'MEMBER' });
const t1 = makeTask({ id: 't1', projectId: 'pt', content: 'Làm báo cáo', reviewStatus: 'PENDING', reviewRequestedBy: 'u-binh', reviewRequestedAt: '2026-10-29T02:30:00Z' });
const t2 = makeTask({ id: 't2', projectId: 'pt', content: 'Gửi hợp đồng', reviewStatus: 'PENDING', reviewRequestedBy: 'u-binh', reviewRequestedAt: '2026-10-28T02:30:00Z' });

function routes(role: 'ADMIN' | 'MEMBER', extra = {}) {
  return {
    'GET /api/v1/tasks': () => jsonResponse(200, page([t1, t2])),
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, team(role === 'ADMIN')]),
    'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ id: 'w1', role })]),
    'GET /api/v1/workspaces/w1/members': () => jsonResponse(200, [binh]),
    'POST /api/v1/tasks/t1/review/approve': () => jsonResponse(200, taskChange({ ...t1, reviewStatus: 'NONE', completedAt: '2026-10-29T03:00:00Z' })),
    'POST /api/v1/tasks/t1/review/reject': () => jsonResponse(200, taskChange({ ...t1, reviewStatus: 'NONE' })),
    'POST /api/v1/tasks/t1/reopen': () => jsonResponse(200, taskChange({ ...t1, reviewStatus: 'NONE' })),
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

  it('Trả lại: the row leaves at once, the request goes after the Undo window', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const { fetchMock } = await renderSignedIn(<ReviewScreen />, routes('ADMIN'));
    await screen.findByText('Làm báo cáo');
    await fireEvent.press(screen.getByTestId('review-reject-t1'));
    expect(await screen.findByText('Đã trả lại')).toBeOnTheScreen();
    expect(screen.queryByTestId('review-row-t1')).toBeNull();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/review/reject')).toHaveLength(0);
    await act(async () => {
      jest.advanceTimersByTime(SNACKBAR_DURATION_MS + 50);
    });
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/review/reject')).toHaveLength(1));
  });

  it('Trả lại + Hoàn tác: the row comes back and nothing is sent', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const { fetchMock } = await renderSignedIn(<ReviewScreen />, routes('ADMIN'));
    await screen.findByText('Làm báo cáo');
    await fireEvent.press(screen.getByTestId('review-reject-t1'));
    await fireEvent.press(await screen.findByTestId('snackbar-action'));
    expect(screen.getByTestId('review-row-t1')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(SNACKBAR_DURATION_MS + 500);
    });
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/review/reject')).toHaveLength(0);
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

describe('ReviewScreen — Member (read only)', () => {
  it('"Đang chờ duyệt của tôi": the same list without Duyệt / Trả lại', async () => {
    await renderSignedIn(<ReviewScreen />, routes('MEMBER'));
    expect(await screen.findByText('Làm báo cáo')).toBeOnTheScreen();
    expect(screen.getByText('Đang chờ duyệt của tôi')).toBeOnTheScreen();
    expect(screen.queryByTestId('review-approve-t1')).toBeNull();
    expect(screen.queryByTestId('review-reject-t1')).toBeNull();
    expect(screen.getByText('Quản trị viên nhóm sẽ duyệt hoặc trả lại các công việc này.')).toBeOnTheScreen();
  });
});
