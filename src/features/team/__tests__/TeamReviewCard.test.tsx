import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { jsonResponse } from '../../../test/http';
import { makeTask, page } from '../../../test/m1Fixtures';
import { makeTeamProject, makeWorkspace } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { TeamScreen } from '../TeamScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));

const pendingTask = (id: string) => makeTask({ id, projectId: 'tp1', reviewStatus: 'PENDING', reviewRequestedBy: 'u9' });

function routes(role: 'ADMIN' | 'MEMBER', pending: number, nextCursor: string | null = null) {
  return {
    'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ id: 'w1', name: 'Công ty', role })]),
    'GET /api/v1/workspaces/w1/projects': () => jsonResponse(200, [makeTeamProject({ id: 'tp1', name: 'Website' })]),
    'GET /api/v1/workspaces/w1/folders': () => jsonResponse(200, []),
    'GET /api/v1/tasks': () => jsonResponse(200, { ...page(Array.from({ length: pending }, (_, i) => pendingTask(`t${i}`))), nextCursor }),
  };
}

describe('Team tab — "Chờ duyệt" card', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Admin: card with the number of tasks waiting, opens the review screen', async () => {
    await renderSignedIn(<TeamScreen />, routes('ADMIN', 3));
    expect(await screen.findByText('3 công việc đang chờ duyệt')).toBeOnTheScreen();
    expect(screen.getByText('Chờ duyệt')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('team-review-card'));
    expect(router.push).toHaveBeenCalledWith('/review');
  });

  it('Admin with nothing waiting still sees the card ("no task")', async () => {
    await renderSignedIn(<TeamScreen />, routes('ADMIN', 0));
    expect(await screen.findByText('Không có công việc nào đang chờ duyệt')).toBeOnTheScreen();
  });

  it('more pages than loaded: "n+"', async () => {
    await renderSignedIn(<TeamScreen />, routes('ADMIN', 2, 'next'));
    expect(await screen.findByText('Hơn 2 công việc đang chờ duyệt')).toBeOnTheScreen();
  });

  it('Member: "Đang chờ duyệt của tôi" only when something of mine waits', async () => {
    await renderSignedIn(<TeamScreen />, routes('MEMBER', 2));
    expect(await screen.findByText('Đang chờ duyệt của tôi')).toBeOnTheScreen();
    expect(screen.getByText('2 công việc đang chờ duyệt')).toBeOnTheScreen();
  });

  it('Member with nothing waiting: no card', async () => {
    await renderSignedIn(<TeamScreen />, routes('MEMBER', 0));
    await screen.findByTestId('team-project-tp1');
    expect(screen.queryByTestId('team-review-card')).toBeNull();
  });
});
