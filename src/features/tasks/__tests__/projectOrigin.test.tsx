import { screen } from '@testing-library/react-native';
import { queryKeys } from '../../../api/queryKeys';
import { mockFetch } from '../../../test/http';
import { makeTask } from '../../../test/m1Fixtures';
import { makeSharedProject, makeWorkspace } from '../../../test/m8aFixtures';
import { createTestQueryClient, renderWithProviders } from '../../../test/render';
import { projectOrigin } from '../projectOrigin';
import { TaskMeta } from '../TaskMeta';

const NOW = new Date('2026-10-28T03:00:00Z');
const team = makeWorkspace({ id: 'w-team', name: 'Nhóm Alpha' });
const personalWs = makeWorkspace({ id: 'w-personal', name: 'Cá nhân', type: 'PERSONAL' });
const teamProject = makeSharedProject({ id: 'p-team', name: 'Thiết kế', workspaceId: 'w-team', access: 'TEAM' });
const sharedProject = makeSharedProject({ id: 'p-shared', name: 'Nhà chung', memberCount: 3 });
const ownProject = makeSharedProject({ id: 'p-own', name: 'Riêng', memberCount: 1 });

describe('projectOrigin', () => {
  it('names the team of a team project', () => {
    expect(projectOrigin(teamProject, [team, personalWs])).toEqual({ kind: 'team', teamName: 'Nhóm Alpha', workspaceId: 'w-team' });
  });

  it('marks a personal project with collaborators as shared', () => {
    expect(projectOrigin(sharedProject, [team, personalWs])).toEqual({ kind: 'shared' });
  });

  it('is personal for an unshared project, the Inbox, or an unknown project', () => {
    expect(projectOrigin(ownProject, [team])).toEqual({ kind: 'personal' });
    expect(projectOrigin(undefined, [team])).toEqual({ kind: 'personal' });
  });

  it('still knows a team project when the workspaces list is not loaded (no name)', () => {
    expect(projectOrigin(teamProject, undefined)).toEqual({ kind: 'team', teamName: null, workspaceId: 'w-team' });
  });
});

describe('TaskMeta project origin (aggregated views)', () => {
  function cached() {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.projects.list(false), [teamProject, sharedProject, ownProject]);
    client.setQueryData(queryKeys.workspaces.list(), [personalWs, team]);
    return client;
  }

  it('shows "project · team" on a task of a team project', async () => {
    const task = makeTask({ id: 't1', projectId: 'p-team', projectName: 'Thiết kế' });
    await renderWithProviders(<TaskMeta task={task} now={NOW} timeZone="Asia/Ho_Chi_Minh" showProject />, cached());
    expect(screen.getByTestId('task-project-t1')).toHaveTextContent('Thiết kế · Nhóm Alpha');
    expect(screen.getByTestId('task-origin-t1')).toBeOnTheScreen();
  });

  it('shows a shared icon and the plain name on a task of a shared personal project', async () => {
    const task = makeTask({ id: 't2', projectId: 'p-shared', projectName: 'Nhà chung' });
    await renderWithProviders(<TaskMeta task={task} now={NOW} timeZone="Asia/Ho_Chi_Minh" showProject />, cached());
    expect(screen.getByTestId('task-project-t2')).toHaveTextContent('Nhà chung');
    expect(screen.getByTestId('task-origin-t2')).toBeOnTheScreen();
  });

  it('keeps a personal task as before, and loads each list at most once for many rows (cold start)', async () => {
    const fetchMock = mockFetch();
    const tasks = ['t3', 't4', 't5'].map((id) => makeTask({ id, projectId: 'p-own', projectName: 'Riêng' }));
    await renderWithProviders(
      <>
        {tasks.map((task) => (
          <TaskMeta key={task.id} task={task} now={NOW} timeZone="Asia/Ho_Chi_Minh" showProject />
        ))}
      </>,
    );
    expect(screen.getByTestId('task-project-t3')).toHaveTextContent('Riêng');
    expect(screen.queryByTestId('task-origin-t3')).toBeNull();
    // Cold start: the rows fetch the shared lists themselves, deduplicated to one request per list.
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => /\/projects(\?|$)/.test(url)).length).toBeLessThanOrEqual(1);
    expect(urls.filter((url) => /\/workspaces(\?|$)/.test(url)).length).toBeLessThanOrEqual(1);
  });
});
