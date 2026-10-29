import { fireEvent, screen } from '@testing-library/react-native';
import type { QueryClient } from '@tanstack/react-query';
import type { Project } from '../../../api/models';
import { queryKeys } from '../../../api/queryKeys';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeTask, page } from '../../../test/m1Fixtures';
import { makeMember, makeSharedProject, makeWorkspace } from '../../../test/m8aFixtures';
import { createTestQueryClient } from '../../../test/render';
import { renderSignedIn } from '../../../test/screen';
import { meQueryKey } from '../../auth/session';
import { ReviewScreen } from '../ReviewScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-29T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const team = {
  ...makeSharedProject({ id: 'pt', name: 'Nhóm', access: 'TEAM', joined: true, canManage: false, workspaceId: 'w1' }),
  capabilities: { canEditTasks: true, canCompleteTasks: true, canManageSections: true, canComment: true, canReview: true },
} as Project;

/** Observers on every query a row could open: the count must not depend on the number of rows, nor on the selection mode. */
async function observers(n: number, selecting: boolean): Promise<number[]> {
  const items = Array.from({ length: n }, (_, i) =>
    makeTask({ id: `t${i}`, projectId: 'pt', content: `Việc ${i}`, reviewStatus: 'PENDING', reviewRequestedBy: 'u-binh', reviewRequestedAt: '2026-10-29T02:30:00Z' }),
  );
  const queryClient: QueryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.projects.list(false), [inboxProject, team]);
  const { unmount } = await renderSignedIn(
    <ReviewScreen />,
    {
      'GET /api/v1/tasks': () => jsonResponse(200, page(items)),
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, team]),
      'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ id: 'w1', role: 'ADMIN' })]),
      'GET /api/v1/workspaces/w1/members': () => jsonResponse(200, [makeMember({ userId: 'u-binh', displayName: 'Bình', role: 'MEMBER' })]),
    },
    queryClient,
  );
  await screen.findByText('Việc 0');
  if (selecting) {
    await fireEvent.press(screen.getByTestId('review-select'));
    await fireEvent.press(screen.getByTestId('review-select-all'));
  }
  const cache = queryClient.getQueryCache();
  const counts = [meQueryKey, queryKeys.projects.list(false), queryKeys.workspaces.list(), queryKeys.workspaces.members('w1')].map(
    (key) => cache.find({ queryKey: key, exact: true })?.getObserversCount() ?? 0,
  );
  unmount();
  return counts;
}

describe('review screen adds no hook / observer per row', () => {
  it('observers are the same for 3 rows and 12 rows, and the same inside the multi-select mode', async () => {
    const few = await observers(3, false);
    const many = await observers(12, false);
    const manySelecting = await observers(12, true);
    expect(many).toEqual(few);
    expect(manySelecting).toEqual(few);
  });
});
